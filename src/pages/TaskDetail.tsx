import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  MessageSquare, 
  CheckSquare,
  Play,
  Pause,
  Calendar,
  Tag,
  History,
  AlertCircle,
  Trash2,
  Plus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  priority: 'low' | 'medium' | 'high';
  total_minutes: number;
  origin: string;
  tags: string[];
  estimated_minutes: number | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  whatsapp_chat_name: string | null;
  whatsapp_phone_number: string | null;
  responsible: { id: string; full_name: string } | null;
  creator: { id: string; full_name: string };
}

interface Comment {
  id: string;
  text: string;
  created_at: string;
  author: { id: string; full_name: string };
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  entry_type: string;
  note: string | null;
  user?: { full_name: string };
}

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-warning', textColor: 'text-warning' },
  in_progress: { label: 'En curso', color: 'bg-primary', textColor: 'text-primary' },
  blocked: { label: 'Bloqueada', color: 'bg-destructive', textColor: 'text-destructive' },
  completed: { label: 'Completada', color: 'bg-success', textColor: 'text-success' },
};

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/20 text-warning',
  high: 'bg-destructive/20 text-destructive',
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    
    fetchTaskData();
    fetchUsers();
    
    // Set up realtime subscription for comments
    const channel = supabase
      .channel(`task-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `task_id=eq.${id}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Timer effect
  useEffect(() => {
    if (!activeTimer) return;
    
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const fetchTaskData = async () => {
    if (!id) return;
    
    setLoading(true);
    
    // Fetch task
    const { data: taskData } = await supabase
      .from('tasks')
      .select(`
        *,
        responsible:profiles!tasks_responsible_id_fkey(id, full_name),
        creator:profiles!tasks_creator_id_fkey(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (taskData) {
      setTask(taskData as any);
    }

    // Fetch other data
    await Promise.all([
      fetchComments(),
      fetchChecklist(),
      fetchTimeEntries(),
      checkActiveTimer(),
    ]);
    
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('active', true)
      .order('full_name');
    
    if (data) setUsers(data);
  };

  const fetchComments = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        author:profiles!comments_author_id_fkey(id, full_name)
      `)
      .eq('task_id', id)
      .order('created_at', { ascending: true });

    if (data) setComments(data as any);
  };

  const fetchChecklist = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('task_id', id)
      .order('position');

    if (data) setChecklist(data);
  };

  const fetchTimeEntries = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('time_entries')
      .select(`
        id,
        start_time,
        end_time,
        duration_minutes,
        entry_type,
        note,
        user:profiles!time_entries_user_id_fkey(full_name)
      `)
      .eq('task_id', id)
      .order('start_time', { ascending: false });

    if (data) setTimeEntries(data as any);
  };

  const checkActiveTimer = async () => {
    if (!id || !profile) return;
    
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('task_id', id)
      .eq('user_id', profile.id)
      .is('end_time', null)
      .single();

    if (data) {
      setActiveTimer(data);
      const elapsed = Math.floor((Date.now() - new Date(data.start_time).getTime()) / 1000);
      setTimerSeconds(elapsed);
    }
  };

  const updateTaskStatus = async (newStatus: Task['status']) => {
    if (!id) return;
    
    const updates: any = { status: newStatus };
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Error al actualizar estado');
    } else {
      toast.success('Estado actualizado');
      fetchTaskData();
    }
  };

  const updateTaskField = async (field: string, value: any) => {
    if (!id) return;
    
    const { error } = await supabase
      .from('tasks')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      toast.error('Error al actualizar');
    } else {
      toast.success('Tarea actualizada');
      fetchTaskData();
    }
  };

  const addComment = async () => {
    if (!id || !profile || !newComment.trim()) return;
    
    const { error } = await supabase
      .from('comments')
      .insert({
        task_id: id,
        author_id: profile.id,
        text: newComment.trim(),
      });

    if (error) {
      toast.error('Error al agregar comentario');
    } else {
      setNewComment('');
      toast.success('Comentario agregado');
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast.error('Error al eliminar comentario');
    } else {
      toast.success('Comentario eliminado');
    }
  };

  const addChecklistItem = async () => {
    if (!id || !newChecklistItem.trim()) return;
    
    const maxPosition = checklist.length > 0 ? Math.max(...checklist.map(i => i.position)) : -1;

    const { error } = await supabase
      .from('checklist_items')
      .insert({
        task_id: id,
        text: newChecklistItem.trim(),
        position: maxPosition + 1,
      });

    if (error) {
      toast.error('Error al agregar ítem');
    } else {
      setNewChecklistItem('');
      fetchChecklist();
      toast.success('Ítem agregado');
    }
  };

  const toggleChecklistItem = async (itemId: string, done: boolean) => {
    const { error } = await supabase
      .from('checklist_items')
      .update({ done })
      .eq('id', itemId);

    if (!error) {
      fetchChecklist();
    }
  };

  const deleteChecklistItem = async (itemId: string) => {
    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId);

    if (!error) {
      fetchChecklist();
      toast.success('Ítem eliminado');
    }
  };

  const startTimer = async () => {
    if (!id || !profile) return;
    
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        task_id: id,
        user_id: profile.id,
        entry_type: 'automatic',
      })
      .select()
      .single();

    if (error) {
      toast.error('Error al iniciar tiempo');
    } else {
      setActiveTimer(data);
      setTimerSeconds(0);
      toast.success('Tiempo iniciado');
      
      // Update task status to in_progress if it's pending
      if (task?.status === 'pending') {
        updateTaskStatus('in_progress');
      }
    }
  };

  const stopTimer = async () => {
    if (!activeTimer || !id) return;
    
    const duration = Math.floor(timerSeconds / 60);

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: new Date().toISOString(),
        duration_minutes: duration,
      })
      .eq('id', activeTimer.id);

    if (error) {
      toast.error('Error al detener tiempo');
    } else {
      setActiveTimer(null);
      setTimerSeconds(0);
      toast.success(`Tiempo guardado: ${formatTime(timerSeconds)}`);
      fetchTimeEntries();
      fetchTaskData();
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  };

  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Tarea no encontrada</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{task.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className={`${statusConfig[task.status].color} text-white`}>
                  {statusConfig[task.status].label}
                </Badge>
                <Badge variant="outline" className={priorityColors[task.priority]}>
                  {task.priority === 'low' ? 'Baja' : task.priority === 'medium' ? 'Media' : 'Alta'}
                </Badge>
                {task.origin !== 'manual' && (
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    WhatsApp
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={task.status} onValueChange={(value: any) => updateTaskStatus(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En curso</SelectItem>
                <SelectItem value="blocked">Bloqueada</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Description */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {task.description || 'Sin descripción'}
                </p>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Checklist</CardTitle>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {checklist.filter(i => i.done).length} / {checklist.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-smooth hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                      className="h-5 w-5 cursor-pointer rounded border-border"
                    />
                    <span className={`flex-1 ${item.done ? 'text-muted-foreground line-through' : ''}`}>
                      {item.text}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteChecklistItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Input
                    placeholder="Nuevo ítem..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                  />
                  <Button onClick={addChecklistItem} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Comments */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Comentarios</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="animate-fade-in rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{comment.author.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                          {comment.author.id === profile?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => deleteComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Escribe un comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                  />
                  <Button onClick={addComment} size="icon" className="h-auto">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timer */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Control de Tiempo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold tabular-nums">
                    {formatTime(timerSeconds)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeTimer ? 'En curso' : 'Detenido'}
                  </p>
                </div>

                {activeTimer ? (
                  <Button onClick={stopTimer} variant="destructive" className="w-full">
                    <Pause className="mr-2 h-4 w-4" />
                    Detener
                  </Button>
                ) : (
                  <Button onClick={startTimer} className="w-full">
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar
                  </Button>
                )}

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total registrado:</span>
                    <span className="font-medium">{formatMinutes(task.total_minutes)}</span>
                  </div>
                  {task.estimated_minutes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimado:</span>
                      <span className="font-medium">{formatMinutes(task.estimated_minutes)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Responsable</label>
                    <Select
                      value={task.responsible?.id || ''}
                      onValueChange={(value) => updateTaskField('responsible_id', value || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Prioridad</label>
                    <Select
                      value={task.priority}
                      onValueChange={(value) => updateTaskField('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Creado por: {task.creator.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDistanceToNow(new Date(task.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                    {task.whatsapp_chat_name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>{task.whatsapp_chat_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time History */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Historial de Tiempo</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="rounded border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{entry.user?.full_name || 'Usuario'}</span>
                        <span className="text-muted-foreground">
                          {formatMinutes(entry.duration_minutes)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.start_time).toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {entry.note && (
                        <p className="mt-1 text-xs italic">{entry.note}</p>
                      )}
                    </div>
                  ))}
                  {timeEntries.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      No hay registros de tiempo
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
