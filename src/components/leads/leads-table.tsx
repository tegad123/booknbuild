"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  niche: string;
  status: string;
  created_at: string;
  last_contact_at: string | null;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  quoted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  booked: "bg-green-100 text-green-800",
  lost: "bg-gray-100 text-gray-800",
};

export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No leads yet. Leads will appear here once your intake forms start
            receiving submissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-left p-3 font-medium">Niche</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {lead.name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {lead.email}
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">{lead.phone}</td>
                  <td className="p-3 capitalize">{lead.niche}</td>
                  <td className="p-3">
                    <Badge
                      variant="secondary"
                      className={statusColors[lead.status] || ""}
                    >
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
