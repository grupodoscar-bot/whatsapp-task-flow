import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart } from 'lucide-react';

export default function Reports() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PieChart className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Informes de Tiempo</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>En desarrollo...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Aquí podrás ver informes detallados de tiempo trabajado por usuario y tarea, con filtros y exportación a Excel.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
