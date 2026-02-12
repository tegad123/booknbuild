import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10 },
  header: { marginBottom: 20, textAlign: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 6 },
  badge: {
    fontSize: 9,
    color: "#b45309",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    color: "#111827",
  },
  subsectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#374151",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    paddingVertical: 1,
  },
  label: { fontSize: 9, color: "#6b7280", flex: 1 },
  value: { fontSize: 9, fontWeight: "bold", flex: 1, textAlign: "right" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  tag: {
    fontSize: 8,
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginVertical: 10,
  },
  linkText: { fontSize: 9, color: "#2563eb", marginBottom: 3 },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 2,
  },
  configLabel: { fontSize: 8, color: "#6b7280", flex: 2 },
  configValue: { fontSize: 8, flex: 1, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#9ca3af",
    textAlign: "center",
  },
  pageNum: {
    position: "absolute",
    bottom: 16,
    right: 36,
    fontSize: 7,
    color: "#9ca3af",
  },
});

interface ConfirmationPdfProps {
  companyName: string;
  ownerEmail: string;
  contactName?: string;
  niches: string[];
  slug: string;
  intakeLinks: string[];
  integrationLinks: Record<string, string>;
  approveUrl: string;
  configSummary: {
    niches: string[];
    primary_niche: string;
    has_twilio: boolean;
    message_template_count: number;
    followup_rule_count: number;
    deposit_percent: number;
    slot_duration_minutes: number;
  };
  brand: {
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
    reply_to?: string;
    support_phone?: string;
  };
  hasTwilio: boolean;
}

export function ConfirmationPdf({
  companyName,
  ownerEmail,
  contactName,
  niches,
  slug,
  intakeLinks,
  integrationLinks,
  approveUrl,
  configSummary,
  brand,
  hasTwilio,
}: ConfirmationPdfProps) {
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      {/* Page 1: Internal Spec */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>BooknBuild Setup Confirmation</Text>
          <Text style={styles.subtitle}>
            Internal configuration spec for {companyName}
          </Text>
          <Text style={styles.badge}>STATUS: PENDING APPROVAL</Text>
        </View>

        {/* Company Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Identity</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Company Name</Text>
            <Text style={styles.value}>{companyName}</Text>
          </View>
          {contactName && (
            <View style={styles.row}>
              <Text style={styles.label}>Contact</Text>
              <Text style={styles.value}>{contactName}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Owner Email</Text>
            <Text style={styles.value}>{ownerEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Organization Slug</Text>
            <Text style={styles.value}>{slug}</Text>
          </View>
        </View>

        {/* Niches */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Niches</Text>
          <View style={styles.tagRow}>
            {niches.map((niche) => (
              <Text key={niche} style={styles.tag}>
                {niche.toUpperCase()}
                {niche === configSummary.primary_niche ? " (PRIMARY)" : ""}
              </Text>
            ))}
          </View>
        </View>

        {/* Branding */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Branding</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Primary Color</Text>
            <Text style={styles.value}>{brand.primary_color || "#2563eb"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Accent Color</Text>
            <Text style={styles.value}>{brand.accent_color || "Default"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Logo URL</Text>
            <Text style={styles.value}>{brand.logo_url || "None"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reply-to Email</Text>
            <Text style={styles.value}>{brand.reply_to || ownerEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Support Phone</Text>
            <Text style={styles.value}>{brand.support_phone || "None"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Config Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Summary</Text>

          <Text style={styles.subsectionTitle}>Booking Settings</Text>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Deposit Required</Text>
            <Text style={styles.configValue}>
              {configSummary.deposit_percent}%
            </Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Appointment Duration</Text>
            <Text style={styles.configValue}>
              {configSummary.slot_duration_minutes} min
            </Text>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.subsectionTitle}>Messaging</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Message Templates</Text>
            <Text style={styles.configValue}>
              {configSummary.message_template_count}
            </Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Follow-up Rules</Text>
            <Text style={styles.configValue}>
              {configSummary.followup_rule_count}
            </Text>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.subsectionTitle}>Integrations</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>SMS (Twilio)</Text>
            <Text style={styles.configValue}>
              {hasTwilio ? "Connected" : "Not configured"}
            </Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Calendar</Text>
            <Text style={styles.configValue}>
              {integrationLinks.calendar ? "Setup link included" : "Not requested"}
            </Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Payments</Text>
            <Text style={styles.configValue}>
              {integrationLinks.payment ? "Setup link included" : "Not requested"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Public Intake Links</Text>
          {intakeLinks.map((link) => (
            <Text key={link} style={styles.linkText}>
              {link}
            </Text>
          ))}
        </View>

        {Object.keys(integrationLinks).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Integration Setup Links
            </Text>
            {Object.entries(integrationLinks).map(([key, url]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.label}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
                <Text style={styles.linkText}>{url}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* Approval */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, color: "#374151" }}>
            Review this configuration and click the link below to approve:
          </Text>
          <Text style={styles.linkText}>{approveUrl}</Text>
          <Text style={{ fontSize: 8, color: "#9ca3af", marginTop: 4 }}>
            If changes are needed, reply to the email this PDF was attached to.
          </Text>
        </View>

        <Text style={styles.footer}>
          Generated by BooknBuild on {generatedDate}
        </Text>
        <Text
          style={styles.pageNum}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>

      {/* Page 2: Customer-Facing Preview */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Customer Experience Preview</Text>
          <Text style={styles.subtitle}>
            What your customers will see when they visit your intake page
          </Text>
        </View>

        {/* Intake Page Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intake Form Preview</Text>
          <Text style={{ fontSize: 9, marginBottom: 8, color: "#6b7280" }}>
            Your branded intake form will be available at:
          </Text>
          {intakeLinks.map((link) => (
            <Text key={link} style={styles.linkText}>
              {link}
            </Text>
          ))}

          <View style={{ marginTop: 10 }}>
            <Text style={styles.subsectionTitle}>Form Header</Text>
            <View
              style={{
                padding: 10,
                backgroundColor: "#f9fafb",
                borderRadius: 4,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>
                Get Your Free {configSummary.primary_niche} Estimate
              </Text>
              <Text style={{ fontSize: 9, color: "#6b7280" }}>
                {companyName} - Fill out the form below and we will get back to
                you with a detailed quote.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 6 }}>
            <Text style={styles.subsectionTitle}>
              Form Fields (from intake schema)
            </Text>
            <Text style={{ fontSize: 8, color: "#9ca3af", marginBottom: 6 }}>
              Standard fields always included: Name, Phone, Email, Address, Photos
            </Text>
            <Text style={{ fontSize: 8, color: "#9ca3af" }}>
              + Niche-specific questions from template (varies by service type)
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Quote Page Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Delivery Preview</Text>
          <Text style={{ fontSize: 9, marginBottom: 8, color: "#6b7280" }}>
            After AI analysis, customers receive a link to their personalized
            quote:
          </Text>

          <View
            style={{
              padding: 10,
              backgroundColor: "#f9fafb",
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
              Your {configSummary.primary_niche} Quote from {companyName}
            </Text>
            <Text style={{ fontSize: 9, color: "#6b7280", marginBottom: 8 }}>
              3-tier pricing packages (Good / Better / Best)
            </Text>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Package Selection</Text>
              <Text style={styles.configValue}>3 tiers shown</Text>
            </View>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Line Items</Text>
              <Text style={styles.configValue}>Detailed breakdown</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Booking Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Flow Preview</Text>
          <Text style={{ fontSize: 9, marginBottom: 8, color: "#6b7280" }}>
            When a customer accepts a quote, they enter the booking flow:
          </Text>

          <View
            style={{
              padding: 10,
              backgroundColor: "#f9fafb",
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 9, marginBottom: 4 }}>
              1. Select an available time slot (
              {configSummary.slot_duration_minutes}-min windows)
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 4 }}>
              2. Slot is held for 10 minutes during checkout
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 4 }}>
              3. Pay {configSummary.deposit_percent}% deposit to confirm
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 4 }}>
              4. Confirmation SMS + email sent automatically
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 4 }}>
              5. Reminders at 24h and 2h before appointment
            </Text>
            <Text style={{ fontSize: 9 }}>
              6. Calendar event created + job sheet emailed to you
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Follow-up Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automated Follow-ups</Text>
          <Text style={{ fontSize: 9, marginBottom: 6, color: "#6b7280" }}>
            {configSummary.followup_rule_count} follow-up rule(s) configured.
            Messages sent via {hasTwilio ? "SMS + email" : "email only"}.
          </Text>
          <Text style={{ fontSize: 8, color: "#9ca3af" }}>
            Follow-ups stop automatically when: booking is created, payment is
            received, customer replies STOP, or lead is marked as lost.
          </Text>
        </View>

        <Text style={styles.footer}>
          Generated by BooknBuild on {generatedDate} - Customer Preview
        </Text>
        <Text
          style={styles.pageNum}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
