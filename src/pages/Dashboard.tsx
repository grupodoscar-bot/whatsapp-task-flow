import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Timer,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  pending: number;
  inProgress: number;
  blocked: number;
  completed: number;
  dueTodayOrPast: number;
  totalMinutesToday: number;
  totalMinutesWeek: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [profile]);

  const fetchStats = async () => {
    if (!profile) return;
    
    setLoading(true);
    
    try {
      // Fetch task counts
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status, due_date');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const pending = tasks?.filter(t => t.status === 'pending').length || 0;
      const inProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;
      const blocked = tasks?.filter(t => t.status === 'blocked').length || 0;
      const completed = tasks?.filter(t => t.status === 'completed').length || 0;
      
      const dueTodayOrPast = tasks?.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate <= now && t.status !== 'completed';
      }).length || 0;

      // Fetch time entries for today and this week
      const { data: timeEntriesToday } = await supabase
        .from('time_entries')
        .select('duration_minutes')
        .eq('user_id', profile.id)
        .gte('start_time', todayStart.toISOString());

      const { data: timeEntriesWeek } = await supabase
        .from('time_entries')
        .select('duration_minutes')
        .eq('user_id', profile.id)
        .gte('start_time', weekStart.toISOString());

      const totalMinutesToday = timeEntriesToday?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0;
      const totalMinutesWeek = timeEntriesWeek?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0;

      setStats({
        pending,
        inProgress,
        blocked,
        completed,
        dueTodayOrPast,
        totalMinutesToday,
        totalMinutesWeek,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Bienvenido, {profile?.full_name}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pendientes
                  </CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-warning">{stats?.pending}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Tareas por iniciar</p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    En curso
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{stats?.inProgress}</div>
                  <p className="mt-1 text-xs text-muted-foreground">En progreso</p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Bloqueadas
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">{stats?.blocked}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Requieren atención</p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completadas
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{stats?.completed}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Finalizadas</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Vencen hoy o están vencidas
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.dueTodayOrPast}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Tareas urgentes</p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tiempo hoy
                  </CardTitle>
                  <Timer className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatMinutes(stats?.totalMinutesToday || 0)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Tu trabajo hoy</p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tiempo esta semana
                  </CardTitle>
                  <Timer className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatMinutes(stats?.totalMinutesWeek || 0)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Total semanal</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
