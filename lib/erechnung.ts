/**
 * E-Rechnung Parser – XRechnung & ZUGFeRD
 * Unterstützt: XRechnung 2.x (UBL + CII), ZUGFeRD 2.1 (Factur-X EN 16931, COMFORT)
 * Pflichtformat für B2B ab 01.01.2025 (§ 14 UStG)
 */

import { XMLParser } from "fast-xml-parser";

export interface ERechnungPosition {
  artikelNr?: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreisNetto: number;
  steuersatz: number;
  gesamtpreisNetto: number;
}

export interface ERechnungDaten {
  format: "XRechnung-UBL" | "XRechnung-CII" | "ZUGFeRD" | "Unbekannt";
  rechnungsnummer: string;
  rechnungsdatum: string;
  lieferdatum?: string;
  faelligkeitsdatum?: string;
  zahlungsziel?: number; // Tage
  lieferant: {
    name: string;
    steuernummer?: string;
    ustIdNr?: string;
    iban?: string;
    bic?: string;
    adresse?: string;
  };
  kaeufer: {
    name: string;
    referenz?: string;
  };
  positionen: ERechnungPosition[];
  summen: {
    nettoGesamt: number;
    steuerBetrag: number;
    bruttoGesamt: number;
    waehrung: string;
  };
  zahlungsreferenz?: string;
  bestellreferenz?: string;
  rohXml?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  trimValues: true,
});

// ─── ZUGFeRD / Factur-X (Cross Industry Invoice – CII) ───────────────────────
function parseCII(xml: string): ERechnungDaten | null {
  try {
    const doc = parser.parse(xml);
    const invoice =
      doc?.["rsm:CrossIndustryInvoice"] ||
      doc?.["CrossIndustryInvoice"] ||
      doc?.["ubl:Invoice"];

    if (!invoice) return null;

    const hdr =
      invoice["rsm:ExchangedDocument"] ||
      invoice["ExchangedDocument"] ||
      {};
    const trns =
      invoice["rsm:SupplyChainTradeTransaction"] ||
      invoice["SupplyChainTradeTransaction"] ||
      {};
    const agreement =
      trns["ram:ApplicableHeaderTradeAgreement"] ||
      trns["ApplicableHeaderTradeAgreement"] ||
      {};
    const settlement =
      trns["ram:ApplicableHeaderTradeSettlement"] ||
      trns["ApplicableHeaderTradeSettlement"] ||
      {};
    const delivery =
      trns["ram:ApplicableHeaderTradeDelivery"] ||
      trns["ApplicableHeaderTradeDelivery"] ||
      {};

    const rechnungsnummer =
      getString(hdr, "ram:ID") ||
      getString(hdr, "ID") ||
      "Unbekannt";

    const rechnungsdatum =
      parseDate(
        getString(hdr, "ram:IssueDateTime.udt:DateTimeString") ||
        getString(hdr, "IssueDateTime.DateTimeString")
      ) || "";

    // Seller
    const seller =
      agreement["ram:SellerTradeParty"] ||
      agreement["SellerTradeParty"] ||
      {};
    const buyer =
      agreement["ram:BuyerTradeParty"] ||
      agreement["BuyerTradeParty"] ||
      {};

    const sellerName =
      getString(seller, "ram:Name") ||
      getString(seller, "Name") ||
      "";

    const sellerTaxReg = toArray(
      seller["ram:SpecifiedTaxRegistration"] ||
      seller["SpecifiedTaxRegistration"]
    );
    const ustIdNr = sellerTaxReg.find((r: any) =>
      (getString(r, "ram:ID.@_schemeID") || getString(r, "ID.@_schemeID")) === "VA"
    );
    const steuernummer = sellerTaxReg.find((r: any) =>
      (getString(r, "ram:ID.@_schemeID") || getString(r, "ID.@_schemeID")) === "FC"
    );

    // Payment
    const paymentMeans =
      settlement["ram:SpecifiedTradeSettlementPaymentMeans"] ||
      settlement["SpecifiedTradeSettlementPaymentMeans"] ||
      {};
    const creditorAccount =
      paymentMeans["ram:PayeePartyCreditorFinancialAccount"] ||
      paymentMeans["PayeePartyCreditorFinancialAccount"] ||
      {};
    const iban =
      getString(creditorAccount, "ram:IBANID") ||
      getString(creditorAccount, "IBANID") ||
      undefined;

    // Monetary summation
    const summation =
      settlement["ram:SpecifiedTradeSettlementHeaderMonetarySummation"] ||
      settlement["SpecifiedTradeSettlementHeaderMonetarySummation"] ||
      {};
    const waehrung =
      getString(settlement, "ram:InvoiceCurrencyCode") ||
      getString(settlement, "InvoiceCurrencyCode") ||
      "EUR";

    const nettoGesamt = parseFloat(
      getString(summation, "ram:TaxBasisTotalAmount") ||
      getString(summation, "TaxBasisTotalAmount") ||
      "0"
    );
    const steuerBetrag = parseFloat(
      getString(summation, "ram:TaxTotalAmount") ||
      getString(summation, "TaxTotalAmount") ||
      "0"
    );
    const bruttoGesamt = parseFloat(
      getString(summation, "ram:GrandTotalAmount") ||
      getString(summation, "GrandTotalAmount") ||
      "0"
    );

    // Line items
    const lineItems = toArray(
      trns["ram:IncludedSupplyChainTradeLineItem"] ||
      trns["IncludedSupplyChainTradeLineItem"]
    );

    const positionen: ERechnungPosition[] = lineItems.map((item: any) => {
      const product =
        item["ram:SpecifiedTradeProduct"] ||
        item["SpecifiedTradeProduct"] ||
        {};
      const lineAgreement =
        item["ram:SpecifiedLineTradeAgreement"] ||
        item["SpecifiedLineTradeAgreement"] ||
        {};
      const lineDelivery =
        item["ram:SpecifiedLineTradeDelivery"] ||
        item["SpecifiedLineTradeDelivery"] ||
        {};
      const lineSettlement =
        item["ram:SpecifiedLineTradeSettlement"] ||
        item["SpecifiedLineTradeSettlement"] ||
        {};
      const monetarySumm =
        lineSettlement["ram:SpecifiedTradeSettlementLineMonetarySummation"] ||
        lineSettlement["SpecifiedTradeSettlementLineMonetarySummation"] ||
        {};

      const menge = parseFloat(
        getString(lineDelivery, "ram:BilledQuantity") ||
        getString(lineDelivery, "BilledQuantity") ||
        "1"
      );
      const einheit =
        getAttr(lineDelivery, "ram:BilledQuantity", "@_unitCode") ||
        getAttr(lineDelivery, "BilledQuantity", "@_unitCode") ||
        "STK";

      const netPreis = parseFloat(
        getString(lineAgreement, "ram:NetPriceProductTradePrice.ram:ChargeAmount") ||
        getString(lineAgreement, "NetPriceProductTradePrice.ChargeAmount") ||
        "0"
      );

      const steuerPos = toArray(
        lineSettlement["ram:ApplicableTradeTax"] ||
        lineSettlement["ApplicableTradeTax"]
      );
      const steuersatz = parseFloat(
        getString(steuerPos[0] || {}, "ram:RateApplicablePercent") ||
        getString(steuerPos[0] || {}, "RateApplicablePercent") ||
        "19"
      );

      const gesamtNetto = parseFloat(
        getString(monetarySumm, "ram:LineTotalAmount") ||
        getString(monetarySumm, "LineTotalAmount") ||
        "0"
      );

      return {
        artikelNr:
          getString(product, "ram:SellerAssignedID") ||
          getString(product, "SellerAssignedID") ||
          undefined,
        bezeichnung:
          getString(product, "ram:Name") ||
          getString(product, "Name") ||
          "Unbekannt",
        menge,
        einheit,
        einzelpreisNetto: netPreis,
        steuersatz,
        gesamtpreisNetto: gesamtNetto,
      };
    });

    return {
      format: "ZUGFeRD",
      rechnungsnummer,
      rechnungsdatum,
      lieferant: {
        name: sellerName,
        ustIdNr: getNestedValue(ustIdNr, "ram:ID") || getNestedValue(ustIdNr, "ID"),
        steuernummer: getNestedValue(steuernummer, "ram:ID") || getNestedValue(steuernummer, "ID"),
        iban,
      },
      kaeufer: {
        name: getString(buyer, "ram:Name") || getString(buyer, "Name") || "",
      },
      positionen,
      summen: { nettoGesamt, steuerBetrag, bruttoGesamt, waehrung },
      rohXml: xml,
    };
  } catch (e) {
    console.error("CII parse error:", e);
    return null;
  }
}

// ─── XRechnung UBL ────────────────────────────────────────────────────────────
function parseUBL(xml: string): ERechnungDaten | null {
  try {
    const doc = parser.parse(xml);
    const invoice = doc?.["ubl:Invoice"] || doc?.["Invoice"];
    if (!invoice) return null;

    const rechnungsnummer =
      getString(invoice, "cbc:ID") || getString(invoice, "ID") || "Unbekannt";
    const rechnungsdatum =
      getString(invoice, "cbc:IssueDate") ||
      getString(invoice, "IssueDate") ||
      "";
    const waehrung =
      getAttr(invoice, "cbc:DocumentCurrencyCode", "#text") ||
      getString(invoice, "cbc:DocumentCurrencyCode") ||
      "EUR";

    const supplier =
      invoice["cac:AccountingSupplierParty"]?.["cac:Party"] ||
      invoice["AccountingSupplierParty"]?.["Party"] ||
      {};
    const customer =
      invoice["cac:AccountingCustomerParty"]?.["cac:Party"] ||
      invoice["AccountingCustomerParty"]?.["Party"] ||
      {};

    const sellerName =
      getString(supplier, "cac:PartyName.cbc:Name") ||
      getString(supplier, "PartyName.Name") ||
      "";

    const paymentMeans = toArray(
      invoice["cac:PaymentMeans"] || invoice["PaymentMeans"]
    )[0] || {};
    const iban =
      getString(paymentMeans, "cac:PayeeFinancialAccount.cbc:ID") ||
      getString(paymentMeans, "PayeeFinancialAccount.ID") ||
      undefined;

    const legalMonetary =
      invoice["cac:LegalMonetaryTotal"] ||
      invoice["LegalMonetaryTotal"] ||
      {};
    const nettoGesamt = parseFloat(
      getString(legalMonetary, "cbc:TaxExclusiveAmount") ||
      getString(legalMonetary, "TaxExclusiveAmount") || "0"
    );
    const bruttoGesamt = parseFloat(
      getString(legalMonetary, "cbc:PayableAmount") ||
      getString(legalMonetary, "PayableAmount") || "0"
    );
    const taxTotal =
      invoice["cac:TaxTotal"] || invoice["TaxTotal"] || {};
    const steuerBetrag = parseFloat(
      getString(taxTotal, "cbc:TaxAmount") ||
      getString(taxTotal, "TaxAmount") || "0"
    );

    const lineItems = toArray(
      invoice["cac:InvoiceLine"] || invoice["InvoiceLine"]
    );

    const positionen: ERechnungPosition[] = lineItems.map((line: any) => {
      const item = line["cac:Item"] || line["Item"] || {};
      const price = line["cac:Price"] || line["Price"] || {};
      const classifiedTax = toArray(
        item["cac:ClassifiedTaxCategory"] || item["ClassifiedTaxCategory"]
      )[0] || {};

      const menge = parseFloat(
        getString(line, "cbc:InvoicedQuantity") ||
        getString(line, "InvoicedQuantity") || "1"
      );
      const einheit =
        getAttr(line, "cbc:InvoicedQuantity", "@_unitCode") || "STK";
      const einzelpreisNetto = parseFloat(
        getString(price, "cbc:PriceAmount") ||
        getString(price, "PriceAmount") || "0"
      );
      const gesamtpreisNetto = parseFloat(
        getString(line, "cbc:LineExtensionAmount") ||
        getString(line, "LineExtensionAmount") || "0"
      );
      const steuersatz = parseFloat(
        getString(classifiedTax, "cbc:Percent") ||
        getString(classifiedTax, "Percent") || "19"
      );

      return {
        bezeichnung:
          getString(item, "cbc:Name") || getString(item, "Name") || "Unbekannt",
        artikelNr:
          getString(item, "cac:SellersItemIdentification.cbc:ID") ||
          getString(item, "SellersItemIdentification.ID") || undefined,
        menge,
        einheit,
        einzelpreisNetto,
        steuersatz,
        gesamtpreisNetto,
      };
    });

    return {
      format: "XRechnung-UBL",
      rechnungsnummer,
      rechnungsdatum,
      lieferant: {
        name: sellerName,
        iban,
      },
      kaeufer: {
        name:
          getString(customer, "cac:PartyName.cbc:Name") ||
          getString(customer, "PartyName.Name") || "",
      },
      positionen,
      summen: { nettoGesamt, steuerBetrag, bruttoGesamt, waehrung },
      rohXml: xml,
    };
  } catch (e) {
    console.error("UBL parse error:", e);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parst eine XML-Zeichenkette als XRechnung (UBL oder CII) oder ZUGFeRD.
 * Erkennt das Format automatisch.
 */
export function parseERechnung(xmlString: string): ERechnungDaten | null {
  const isCII =
    xmlString.includes("CrossIndustryInvoice") ||
    xmlString.includes("rsm:CrossIndustryInvoice");
  const isUBL =
    xmlString.includes("ubl:Invoice") ||
    xmlString.includes("<Invoice ");

  if (isCII) return { ...(parseCII(xmlString) ?? {}), format: xmlString.includes("ZUGFeRD") ? "ZUGFeRD" : "XRechnung-CII" } as ERechnungDaten;
  if (isUBL) return parseUBL(xmlString);

  return null;
}

/**
 * Extrahiert das eingebettete XML aus einer ZUGFeRD-PDF (Base64).
 * Die XML-Datei heißt in ZUGFeRD: factur-x.xml oder ZUGFeRD-invoice.xml
 */
export async function extractZUGFeRDFromPDF(pdfBase64: string): Promise<string | null> {
  try {
    const cleaned = pdfBase64.replace(/^data:.*?;base64,/, "");
    const pdfBytes = Buffer.from(cleaned, "base64");

    const xmlStart = pdfBytes.indexOf(Buffer.from("<?xml"));
    if (xmlStart === -1) return null;

    const ciiClose = "</rsm:CrossIndustryInvoice>";
    const ublClose = "</ubl:Invoice>";
    const ciiEnd = pdfBytes.lastIndexOf(Buffer.from(ciiClose));
    const ublEnd = pdfBytes.lastIndexOf(Buffer.from(ublClose));

    if (ciiEnd === -1 && ublEnd === -1) return null;

    const useCii = ciiEnd > ublEnd;
    const end = useCii ? ciiEnd : ublEnd;
    const suffix = useCii ? ciiClose : ublClose;

    return pdfBytes.slice(xmlStart, end + suffix.length).toString("utf-8");
  } catch (e) {
    console.error("ZUGFeRD extraction error:", e);
    return null;
  }
}

/**
 * Validiert eine ERechnung auf Mindestanforderungen nach EN 16931 / CIUS DE.
 */
export function validateERechnung(daten: ERechnungDaten): { valid: boolean; fehler: string[] } {
  const fehler: string[] = [];

  if (!daten.rechnungsnummer) fehler.push("Rechnungsnummer fehlt (BT-1)");
  if (!daten.rechnungsdatum) fehler.push("Rechnungsdatum fehlt (BT-2)");
  if (!daten.lieferant?.name) fehler.push("Lieferant Name fehlt (BT-44)");
  if (!daten.lieferant?.ustIdNr && !daten.lieferant?.steuernummer)
    fehler.push("Steuer-ID oder USt-IdNr des Lieferanten fehlt (BT-31/BT-32)");
  if (daten.positionen.length === 0) fehler.push("Keine Rechnungspositionen vorhanden");
  if (daten.summen.bruttoGesamt <= 0) fehler.push("Rechnungsbetrag muss größer als 0 sein");

  return { valid: fehler.length === 0, fehler };
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function getString(obj: any, path: string): string {
  if (!obj) return "";
  const parts = path.split(".");
  let current = obj;
  for (const p of parts) {
    if (current == null) return "";
    current = current[p];
  }
  if (typeof current === "object" && current !== null) {
    return current["#text"] ?? String(current) ?? "";
  }
  return current != null ? String(current) : "";
}

function getAttr(obj: any, key: string, attr: string): string {
  const val = obj?.[key];
  if (!val) return "";
  return val[attr] ?? "";
}

function getNestedValue(obj: any, key: string): string | undefined {
  if (!obj) return undefined;
  const val = obj[key];
  if (!val) return undefined;
  if (typeof val === "object") return val["#text"] ?? undefined;
  return String(val);
}

function toArray(val: any): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function parseDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.length === 8) {
    // YYYYMMDD format
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}
