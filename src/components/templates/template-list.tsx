"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Template {
  id: string;
  niche: string;
  name: string;
  template_json: Record<string, unknown>;
  created_at: string;
}

export function TemplateList({
  templates,
  orgId,
}: {
  templates: Template[];
  orgId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [applying, setApplying] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [cloneName, setCloneName] = useState("");

  async function handleApply(templateId: string) {
    if (!orgId) return alert("No active organization. Set up your org first.");
    setApplying(templateId);

    const res = await fetch("/api/templates/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, template_id: templateId }),
    });

    if (res.ok) {
      router.refresh();
      alert("Template applied successfully!");
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
    setApplying(null);
  }

  async function handleClone() {
    if (!orgId) return alert("No active organization.");
    if (!cloneName.trim()) return alert("Enter a template name.");
    setCloning(true);

    const res = await fetch("/api/templates/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name: cloneName }),
    });

    if (res.ok) {
      setCloneName("");
      router.refresh();
      alert("Template cloned from your org config!");
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
    setCloning(false);
  }

  const nicheColors: Record<string, string> = {
    fencing: "bg-green-100 text-green-800",
    roofing: "bg-blue-100 text-blue-800",
    concrete: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      {/* Available Templates */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No templates found. Run the seed SQL to populate templates.
              </p>
            </CardContent>
          </Card>
        )}
        {templates.map((tpl) => (
          <Card key={tpl.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{tpl.name}</CardTitle>
                <Badge
                  variant="secondary"
                  className={nicheColors[tpl.niche] ?? ""}
                >
                  {tpl.niche}
                </Badge>
              </div>
              <CardDescription>
                {(tpl.template_json as any)?.intake_schema?.questions?.length ?? 0}{" "}
                intake questions,{" "}
                {(tpl.template_json as any)?.message_templates?.length ?? 0}{" "}
                message templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                onClick={() => handleApply(tpl.id)}
                disabled={applying !== null || !orgId}
              >
                {applying === tpl.id ? "Applying..." : "Apply to Org"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clone from Org */}
      <Card>
        <CardHeader>
          <CardTitle>Clone from This Org</CardTitle>
          <CardDescription>
            Create a new template from your current org configuration,
            message templates, and follow-up rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input
            placeholder="New template name"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            onClick={handleClone}
            disabled={cloning || !orgId}
            variant="outline"
          >
            {cloning ? "Cloning..." : "Clone"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
