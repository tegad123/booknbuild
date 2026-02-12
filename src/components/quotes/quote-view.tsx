"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LineItem {
  label: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface Package {
  name: string;
  tier: string;
  line_items: LineItem[];
  subtotal: number;
}

interface QuoteViewProps {
  quote: {
    id: string;
    niche: string;
    status: string;
    packages_json: Package[];
    totals_json: {
      economy_total: number;
      mid_total: number;
      premium_total: number;
    };
    needs_approval: boolean;
  };
  brandColor: string;
  bookingUrl: string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function QuoteView({ quote, brandColor, bookingUrl }: QuoteViewProps) {
  const packages = quote.packages_json || [];

  if (packages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">Your quote is being prepared...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {packages.map((pkg, idx) => {
        const isMiddle = idx === 1;
        return (
          <Card
            key={pkg.tier}
            className={isMiddle ? "ring-2 md:scale-105" : ""}
            style={isMiddle ? { borderColor: brandColor, "--tw-ring-color": brandColor } as React.CSSProperties : {}}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                {isMiddle && (
                  <Badge
                    style={{ backgroundColor: brandColor, color: "white" }}
                  >
                    Recommended
                  </Badge>
                )}
              </div>
              <p
                className="text-3xl font-bold mt-2"
                style={{ color: isMiddle ? brandColor : undefined }}
              >
                {formatCents(pkg.subtotal)}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {pkg.line_items.map((item, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-gray-600">
                      {item.label}
                      <span className="text-gray-400 ml-1">
                        ({item.quantity} {item.unit})
                      </span>
                    </span>
                    <span className="font-medium">
                      {formatCents(item.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                style={
                  isMiddle
                    ? { backgroundColor: brandColor, color: "white" }
                    : {}
                }
                variant={isMiddle ? "default" : "outline"}
                asChild
              >
                <a href={`${bookingUrl}?package=${pkg.tier}`}>
                  Choose {pkg.name}
                </a>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
