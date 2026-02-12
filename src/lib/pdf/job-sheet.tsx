import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    color: "#666",
  },
  value: {
    fontWeight: "bold",
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
    fontWeight: "bold",
    fontSize: 13,
  },
  notes: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface JobSheetProps {
  companyName: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  niche: string;
  packageName: string;
  lineItems: Array<{
    label: string;
    quantity: number;
    unit: string;
    total: number;
  }>;
  subtotal: number;
  depositPaid: number;
  balanceDue: number;
  appointmentDate: string;
  appointmentTime: string;
  internalNotes?: string;
  verificationClause?: string;
}

export function JobSheetDocument(props: JobSheetProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>
          {props.companyName} - Job Sheet
        </Text>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{props.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Address:</Text>
            <Text style={styles.value}>{props.customerAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{props.customerPhone}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{props.customerEmail}</Text>
          </View>
        </View>

        {/* Job Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Service Type:</Text>
            <Text style={styles.value}>{props.niche}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Package:</Text>
            <Text style={styles.value}>{props.packageName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Scheduled Date:</Text>
            <Text style={styles.value}>{props.appointmentDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Scheduled Time:</Text>
            <Text style={styles.value}>{props.appointmentTime}</Text>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          {props.lineItems.map((item, i) => (
            <View key={i} style={styles.lineItem}>
              <Text>
                {item.label} ({item.quantity} {item.unit})
              </Text>
              <Text>{formatCents(item.total)}</Text>
            </View>
          ))}
          <View style={styles.total}>
            <Text>Total</Text>
            <Text>{formatCents(props.subtotal)}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Deposit Paid:</Text>
            <Text style={styles.value}>{formatCents(props.depositPaid)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Balance Due:</Text>
            <Text style={styles.value}>{formatCents(props.balanceDue)}</Text>
          </View>
        </View>

        {/* Internal Notes */}
        {props.internalNotes && (
          <View style={styles.notes}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>
              Internal Notes:
            </Text>
            <Text>{props.internalNotes}</Text>
          </View>
        )}

        {/* Verification */}
        {props.verificationClause && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 8, color: "#999" }}>
              {props.verificationClause}
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          Generated by BooknBuild on{" "}
          {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}
