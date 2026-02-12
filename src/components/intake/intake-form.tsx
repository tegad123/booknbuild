"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUploader } from "./photo-uploader";

interface Question {
  key: string;
  label: string;
  type: "text" | "select" | "number" | "textarea" | "checkbox";
  options?: string[];
  required: boolean;
}

export function IntakeForm({
  orgId,
  orgSlug,
  niche,
  questions,
  brandColor,
}: {
  orgId: string;
  orgSlug: string;
  niche: string;
  questions: Question[];
  brandColor: string;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return alert("Please accept the consent checkbox.");
    setSubmitting(true);

    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo);
        formData.append("org_id", orgId);

        const res = await fetch("/api/intake/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const { url } = await res.json();
          photoUrls.push(url);
        }
      }

      // Submit intake
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          niche,
          name: formData.name || "",
          phone: formData.phone || "",
          email: formData.email || "",
          address: formData.address || "",
          customer_estimate: formData.customer_estimate || "",
          answers: formData,
          photo_urls: photoUrls,
          consent: {
            accepted: true,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
          },
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const err = await res.json();
        alert(`Submission failed: ${err.error}`);
      }
    } catch (err) {
      alert("Submission failed. Please try again.");
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mb-4 text-4xl">&#10003;</div>
          <h2 className="text-2xl font-bold">Thank You!</h2>
          <p className="mt-2 text-muted-foreground">
            We&apos;re generating your quote now. You&apos;ll receive it via
            text and email shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Full Name <span className="text-destructive">*</span>
            </label>
            <Input
              required
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="John Smith"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Phone Number <span className="text-destructive">*</span>
            </label>
            <Input
              required
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="(555) 555-1234"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Email <span className="text-destructive">*</span>
            </label>
            <Input
              required
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Property Address <span className="text-destructive">*</span>
            </label>
            <Input
              required
              value={formData.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q) => (
              <div key={q.key}>
                <label className="mb-1 block text-sm font-medium">
                  {q.label}
                  {q.required && (
                    <span className="text-destructive"> *</span>
                  )}
                </label>
                {q.type === "select" && q.options ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    required={q.required}
                    value={formData[q.key] || ""}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {q.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : q.type === "textarea" ? (
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    required={q.required}
                    value={formData[q.key] || ""}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                  />
                ) : (
                  <Input
                    type={q.type === "number" ? "number" : "text"}
                    required={q.required}
                    value={formData[q.key] || ""}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Estimate</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="mb-1 block text-sm font-medium">
            What do you think this project will cost? (optional)
          </label>
          <Input
            type="text"
            value={formData.customer_estimate || ""}
            onChange={(e) => handleChange("customer_estimate", e.target.value)}
            placeholder="e.g. $2,000 - $3,000"
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUploader
            photos={photos}
            onChange={setPhotos}
            max={5}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
              required
            />
            <span className="text-sm text-muted-foreground">
              I consent to receiving communications about my quote via SMS and
              email. I understand my information will be used to provide a
              project estimate. Standard messaging rates may apply.
            </span>
          </label>
        </CardContent>
      </Card>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={submitting}
        style={{ backgroundColor: brandColor }}
      >
        {submitting ? "Submitting..." : "Get My Free Quote"}
      </Button>
    </form>
  );
}
