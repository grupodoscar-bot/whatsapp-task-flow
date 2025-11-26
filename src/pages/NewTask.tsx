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
import { ArrowLeft, MessageSquare } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
}

export default function NewTask() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    whatsapp_message: '',
    whatsapp_chat_name: '',
    whatsapp_phone_number: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    responsible_id: '',
    estimated_minutes: '',
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
    
    setLoading(true);

    try {
      const { error } = await supabase.from('tasks').insert({
        title: formData.title,
        description: `${formData.description}\n\n--- Mensaje de WhatsApp ---\n${formData.whatsapp_message}`,
        priority: formData.priority,
        responsible_id: formData.responsible_id || null,
        creator_id: profile.id,
        origin: 'whatsapp_message',
        whatsapp_chat_name: formData.whatsapp_chat_name,
        whatsapp_phone_number: formData.whatsapp_phone_number,
        estimated_minutes: formData.estimated_minutes ? parseInt(formData.estimated_minutes) : null,
        due_date: formData.due_date || null,
      });

      if (error) throw error;

      toast.success('Tarea creada exitosamente');
      navigate('/tasks');
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la tarea');
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
            <h1 className="text-3xl font-bold">Nueva tarea desde WhatsApp</h1>
            <p className="text-muted-foreground">Crea una tarea a partir de un mensaje de WhatsApp</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Información de la tarea</CardTitle>
            </div>
            <CardDescription>
              Completa los campos con la información del mensaje de WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Título de la tarea *</Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Resumen del mensaje"
                  />
                </div>

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
                  <Label htmlFor="responsible">Responsable</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="due_date">Fecha de vencimiento</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated_minutes">Tiempo estimado (minutos)</Label>
                  <Input
                    id="estimated_minutes"
                    type="number"
                    min="0"
                    value={formData.estimated_minutes}
                    onChange={(e) => setFormData({ ...formData, estimated_minutes: e.target.value })}
                    placeholder="60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_message">Mensaje de WhatsApp *</Label>
                <Textarea
                  id="whatsapp_message"
                  required
                  value={formData.whatsapp_message}
                  onChange={(e) => setFormData({ ...formData, whatsapp_message: e.target.value })}
                  placeholder="Pega aquí el mensaje completo de WhatsApp"
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Notas adicionales</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Información extra o contexto"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate('/tasks')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear tarea'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
