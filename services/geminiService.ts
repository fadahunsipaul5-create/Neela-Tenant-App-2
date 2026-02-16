
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Tenant, LegalNoticeType } from '../types';

// Note: In a real production app, we would proxy this through a backend to protect the API Key.
// For this demo, we use import.meta.env.VITE_GEMINI_API_KEY from environment variables.

const modelId = 'gemini-2.5-flash';

// Lazy initialization function to get GoogleGenAI instance
function getAIInstance(): GoogleGenAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env.local file. ' +
      'See README.md for setup instructions.'
    );
  }
  
  return new GoogleGenAI({ apiKey });
}

export const generateLegalNotice = async (tenant: Tenant, noticeType: LegalNoticeType): Promise<string> => {
  const prompt = `
    Act as a seasoned Texas property attorney and property manager.
    Create a strictly compliant legal document for the following scenario based on Texas Property Code.

    Document Type: ${noticeType}
    
    Tenant Details:
    Name: ${tenant.name}
    Address: ${tenant.propertyUnit}
    Lease Start: ${tenant.leaseStart}
    Current Balance Owed: $${tenant.balance}
    Rent Amount: $${tenant.rentAmount}

    Requirements:
    1. If this is a "3-Day Notice to Vacate", cite Texas Property Code Section 24.005. Explicitly state the right to vacate or pay (if applicable by lease) and the deadline.
    2. If this is a "Eviction Filing Packet", list the required documents and provide a summary affidavit of non-payment.
    3. Tone: Formal, legally binding, assertive but professional.
    4. Format: Markdown, ready to be printed. Include placeholders for [Date], [Landlord Signature], and [Delivery Method].

    Output ONLY the document text.
  `;

  try {
    const ai = getAIInstance();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Error generating legal document.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error instanceof Error && error.message.includes('API key')) {
      return error.message;
    }
    return "Failed to generate document. Please check your API key configuration.";
  }
};

export const analyzeMaintenanceRequest = async (description: string): Promise<{ priority: string; vendorType: string; summary: string }> => {
  const prompt = `
    Analyze the following property maintenance request.
    Description: "${description}"

    Return a JSON object with:
    1. "priority": One of ["Low", "Medium", "High", "Emergency"] based on potential property damage or habitability.
    2. "vendorType": Best tradesperson for the job (e.g., Plumber, Electrician, HVAC, Handyman).
    3. "summary": A 1-sentence technical summary for the vendor.

    Ensure valid JSON output.
  `;

  try {
    const ai = getAIInstance();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    
    const text = response.text;
    if (!text) throw new Error("No text returned");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    if (error instanceof Error && error.message.includes('API key')) {
      // Return fallback but log the error
      console.warn("API key error in maintenance analysis:", error.message);
    }
    return { priority: 'Medium', vendorType: 'General', summary: 'Could not analyze automatically.' };
  }
};

export const generateLeaseAgreement = async (tenant: Tenant, templateType: string = 'Standard Texas Residential'): Promise<string> => {
  const prompt = `
    Create a Residential Lease Agreement for Texas.
    
    Role: Property Manager & Legal Assistant
    Template Type: ${templateType}
    
    Landlord: Neela Capital Investment
    Tenant: ${tenant.name}
    Property: ${tenant.propertyUnit}
    Rent: $${tenant.rentAmount}/month
    Start Date: ${tenant.leaseStart}
    End Date: ${tenant.leaseEnd}
    Deposit: $${tenant.deposit}
    
    Requirements:
    - Include standard Texas clauses for late fees, maintenance, right of entry, and security deposit.
    - If "Month-to-Month", ensure 30-day notice clauses are prominent.
    - If "Student Housing", include quiet hours and guarantor clauses.
    - Format as clean, structured Markdown with clear section headers.
  `;

  try {
    const ai = getAIInstance();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Error generating lease.";
  } catch (error) {
    console.error("Gemini Lease Gen Error:", error);
    if (error instanceof Error && error.message.includes('API key')) {
      return error.message;
    }
    return "Failed to generate lease. Please try again.";
  }
};