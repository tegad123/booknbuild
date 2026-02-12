import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, FileText, Calendar, DollarSign } from "lucide-react";

const stats = [
  { label: "Total Leads", value: "0", icon: Users },
  { label: "Active Quotes", value: "0", icon: FileText },
  { label: "Appointments", value: "0", icon: Calendar },
  { label: "Revenue", value: "$0", icon: DollarSign },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your business activity
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
