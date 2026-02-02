import { formatCurrency } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
}

export default function StatsCard({ title, value, icon, subtitle }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-blue-500 text-3xl">{icon}</div>
        )}
      </div>
    </div>
  );
}
