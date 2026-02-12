"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LeadDetailProps {
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    niche: string;
    status: string;
    created_at: string;
  };
  intake: {
    answers_json: Record<string, string>;
    consent_json: Record<string, string>;
    created_at: string;
  } | null;
  measurements: Array<{
    id: string;
    source: string;
    value_type: string;
    value: number;
    confidence: number;
    metadata_json: Record<string, unknown>;
    created_at: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    metadata_json: Record<string, unknown>;
    created_at: string;
  }>;
  messages: Array<{
    id: string;
    channel: string;
    direction: string;
    body: string;
    created_at: string;
  }>;
}

function formatConfidence(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function LeadDetail({
  lead,
  intake,
  measurements,
  events,
  messages,
}: LeadDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.address}</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {lead.status}
        </Badge>
      </div>

      {/* Contact + Intake */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{lead.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{lead.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Niche</span>
              <span className="capitalize">{lead.niche}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span>{new Date(lead.created_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {intake && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Intake Answers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(intake.answers_json).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Measurements */}
      {measurements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Measurements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {measurements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={m.source === "selected" ? "default" : "secondary"}
                    >
                      {m.source}
                    </Badge>
                    <span>{m.value_type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{m.value}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatConfidence(m.confidence)} confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-sm p-3 rounded-lg ${
                    msg.direction === "outbound"
                      ? "bg-blue-50 ml-8"
                      : "bg-gray-50 mr-8"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {msg.channel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {msg.direction === "outbound" ? "Sent" : "Received"}{" "}
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity timeline */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">
                    {event.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
