import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowLeft, ListChecks } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
}

export default function NewPollTask() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    poll_title: '',
    poll_options: '',
    whatsapp_chat_name: '',
    whatsapp_phone_number: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    responsible_id: '',
    due_date: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('active', true)
      .order('full_name');
    
    if (data) setUsers(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const options = formData.poll_options
      .split('\n')
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);

    if (options.length === 0) {
      toast.error('Debes agregar al menos una opción');
      return;
    }

    setLoading(true);

    try {
      const tasks = options.map((option) => ({
        title: option,
        description: `Tarea creada desde encuesta de WhatsApp: "${formData.poll_title}"`,
        priority: formData.priority,
        responsible_id: formData.responsible_id || null,
        creator_id: profile.id,
        origin: 'whatsapp_poll' as const,
        whatsapp_chat_name: formData.whatsapp_chat_name,
        whatsapp_phone_number: formData.whatsapp_phone_number,
        due_date: formData.due_date || null,
      }));

      const { error } = await supabase.from('tasks').insert(tasks);

      if (error) throw error;

      toast.success(`${tasks.length} tareas creadas exitosamente`);
      navigate('/tasks');
    } catch (error: any) {
      toast.error(error.message || 'Error al crear las tareas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tareas desde encuesta de WhatsApp</h1>
            <p className="text-muted-foreground">Crea múltiples tareas a partir de las opciones de una encuesta</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <CardTitle>Información de la encuesta</CardTitle>
            </div>
            <CardDescription>
              Se creará una tarea por cada opción de la encuesta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="poll_title">Título de la encuesta *</Label>
                <Input
                  id="poll_title"
                  required
                  value={formData.poll_title}
                  onChange={(e) => setFormData({ ...formData, poll_title: e.target.value })}
                  placeholder="¿Qué tareas debemos completar esta semana?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="poll_options">Opciones de la encuesta (una por línea) *</Label>
                <Textarea
                  id="poll_options"
                  required
                  value={formData.poll_options}
                  onChange={(e) => setFormData({ ...formData, poll_options: e.target.value })}
                  placeholder="Actualizar base de datos&#10;Revisar reportes&#10;Contactar clientes&#10;Preparar presentación"
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  Cada línea se convertirá en una tarea independiente
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_chat_name">Nombre del chat/grupo *</Label>
                  <Input
                    id="whatsapp_chat_name"
                    required
                    value={formData.whatsapp_chat_name}
                    onChange={(e) => setFormData({ ...formData, whatsapp_chat_name: e.target.value })}
                    placeholder="Ej: Equipo Ventas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_phone_number">Número de teléfono principal</Label>
                  <Input
                    id="whatsapp_phone_number"
                    value={formData.whatsapp_phone_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_phone_number: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad *</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsible">Responsable por defecto</Label>
                  <Select
                    value={formData.responsible_id}
                    onValueChange={(value) => setFormData({ ...formData, responsible_id: value })}
                  >
                    <SelectTrigger id="responsible">
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="due_date">Fecha de vencimiento (aplica a todas las tareas)</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate('/tasks')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear tareas'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
