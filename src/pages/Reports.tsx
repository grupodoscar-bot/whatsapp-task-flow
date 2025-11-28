import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Download, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface TimeEntry {
  id: string;
  duration_minutes: number;
  start_time: string;
  task: { title: string };
  user: { full_name: string };
}

export default function Reports() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfWeek(new Date(), { locale: es }),
    to: endOfWeek(new Date(), { locale: es })
  });
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('week');

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title')
        .order('title');
      if (error) throw error;
      return data;
    }
  });

  // Fetch time entries
  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ['time-entries-report', dateRange, selectedUser, selectedTask],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select(`
          id,
          duration_minutes,
          start_time,
          task:tasks(title),
          user:profiles!time_entries_user_id_fkey(full_name)
        `)
        .gte('start_time', dateRange.from.toISOString())
        .lte('start_time', dateRange.to.toISOString())
        .not('duration_minutes', 'is', null);

      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }
      if (selectedTask !== 'all') {
        query = query.eq('task_id', selectedTask);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TimeEntry[];
    }
  });

  // Calculate statistics
  const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMinutesRemainder = totalMinutes % 60;

  // Group by user
  const timeByUser = timeEntries.reduce((acc, entry) => {
    const userName = entry.user?.full_name || 'Sin asignar';
    acc[userName] = (acc[userName] || 0) + (entry.duration_minutes || 0);
    return acc;
  }, {} as Record<string, number>);

  const userChartData = Object.entries(timeByUser).map(([name, minutes]) => ({
    name,
    horas: Math.round((minutes / 60) * 10) / 10
  }));

  // Group by task
  const timeByTask = timeEntries.reduce((acc, entry) => {
    const taskTitle = entry.task?.title || 'Sin tarea';
    acc[taskTitle] = (acc[taskTitle] || 0) + (entry.duration_minutes || 0);
    return acc;
  }, {} as Record<string, number>);

  const taskChartData = Object.entries(timeByTask).map(([name, minutes]) => ({
    name,
    value: Math.round((minutes / 60) * 10) / 10
  }));

  // Group by date
  const timeByDate = timeEntries.reduce((acc, entry) => {
    const date = format(new Date(entry.start_time), 'dd/MM', { locale: es });
    acc[date] = (acc[date] || 0) + (entry.duration_minutes || 0);
    return acc;
  }, {} as Record<string, number>);

  const dateChartData = Object.entries(timeByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, minutes]) => ({
      fecha: date,
      horas: Math.round((minutes / 60) * 10) / 10
    }));

  // Handle date preset changes
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case 'week':
        setDateRange({ from: startOfWeek(now, { locale: es }), to: endOfWeek(now, { locale: es }) });
        break;
      case 'last-week':
        setDateRange({
          from: startOfWeek(subWeeks(now, 1), { locale: es }),
          to: endOfWeek(subWeeks(now, 1), { locale: es })
        });
        break;
      case 'month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'last-month':
        setDateRange({
          from: startOfMonth(subMonths(now, 1)),
          to: endOfMonth(subMonths(now, 1))
        });
        break;
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Tarea', 'Horas'];
    const rows = timeEntries.map(entry => [
      format(new Date(entry.start_time), 'dd/MM/yyyy HH:mm', { locale: es }),
      entry.user?.full_name || 'Sin asignar',
      entry.task?.title || 'Sin tarea',
      ((entry.duration_minutes || 0) / 60).toFixed(2)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `informe-tiempo-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({ title: 'Informe exportado', description: 'El archivo CSV se ha descargado correctamente' });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Informes de Tiempo</h1>
          </div>
          <Button onClick={exportToCSV} disabled={timeEntries.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Período</label>
                <Select value={datePreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Esta semana</SelectItem>
                    <SelectItem value="last-week">Semana pasada</SelectItem>
                    <SelectItem value="month">Este mes</SelectItem>
                    <SelectItem value="last-month">Mes pasado</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {datePreset === 'custom' && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Desde</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(dateRange.from, 'dd/MM/yyyy', { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Hasta</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium">Usuario</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Tarea</label>
                <Select value={selectedTask} onValueChange={setSelectedTask}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Total</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalHours}h {totalMinutesRemainder}m
              </div>
              <p className="text-xs text-muted-foreground">
                {timeEntries.length} entradas de tiempo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(timeByUser).length}</div>
              <p className="text-xs text-muted-foreground">
                Promedio: {Object.keys(timeByUser).length > 0 ? Math.round(totalMinutes / Object.keys(timeByUser).length / 60) : 0}h por usuario
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tareas Trabajadas</CardTitle>
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(timeByTask).length}</div>
              <p className="text-xs text-muted-foreground">
                Promedio: {Object.keys(timeByTask).length > 0 ? Math.round(totalMinutes / Object.keys(timeByTask).length / 60) : 0}h por tarea
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {isLoading ? (
          <Card>
            <CardContent className="flex h-96 items-center justify-center">
              <p className="text-muted-foreground">Cargando datos...</p>
            </CardContent>
          </Card>
        ) : timeEntries.length === 0 ? (
          <Card>
            <CardContent className="flex h-96 items-center justify-center">
              <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Time by User - Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Tiempo por Usuario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={userChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Horas', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="horas" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time by Task - Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Distribución por Tarea
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={taskChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}h`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {taskChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time Evolution - Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Evolución Temporal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dateChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis label={{ value: 'Horas', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="horas" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
