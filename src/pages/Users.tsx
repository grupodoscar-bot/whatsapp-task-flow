import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users as UsersIcon } from 'lucide-react';

export default function Users() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>En desarrollo...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Aquí los administradores podrán gestionar usuarios, roles y permisos.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
