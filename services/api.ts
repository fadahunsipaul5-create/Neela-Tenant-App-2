import { Tenant, Payment, MaintenanceRequest, Listing, Property } from '../types';
import { getAuthHeader, clearInvalidTokens, refreshAccessToken, refreshTokenIfNeeded } from './auth';

// const BASE_URL = import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_URL = `${BASE_URL}/api`;

// Track if we're currently refreshing to avoid multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Helper function to get headers with authentications.
 * @param includeContentType - Whether to include Content-Type headers
 * @param includeAuth - Whether to include Authorization header (default: true)
 */
const getHeaders = (includeContentType: boolean = true, includeAuth: boolean = true): HeadersInit => {
  const headers: HeadersInit = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (includeAuth) {
    const authHeader = getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
  }
  return headers;
};

/**
 * Wrapper for fetch that automatically handles token refresh on 401 errors.
 * Proactively refreshes tokens if they're expiring soon.
 */
const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
  retryOn401: boolean = true
): Promise<Response> => {
  // Proactively refresh token if it's expiring soon (before making the request)
  if (options.headers && 'Authorization' in (options.headers as any)) {
    await refreshTokenIfNeeded();
  }

  // Make the initial request
  let response = await fetch(url, options);

  // If we get a 401 and retry is enabled, try to refresh token and retry
  if (response.status === 401 && retryOn401 && options.headers && 'Authorization' in (options.headers as any)) {
    // Check if we're already refreshing
    if (isRefreshing && refreshPromise) {
      // Wait for the ongoing refresh to complete
      await refreshPromise;
      // Retry the request with new token
      const newHeaders = { ...options.headers };
      const authHeader = getAuthHeader();
      if (authHeader) {
        (newHeaders as any)['Authorization'] = authHeader;
      }
      response = await fetch(url, { ...options, headers: newHeaders });
    } else {
      // Start refresh process
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          await refreshAccessToken();
        } catch (error) {
          // Refresh failed - clear tokens and let the 401 propagate
          clearInvalidTokens();
          throw error;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();

      try {
        await refreshPromise;
        // Retry the request with new token
        const newHeaders = { ...options.headers };
        const authHeader = getAuthHeader();
        if (authHeader) {
          (newHeaders as any)['Authorization'] = authHeader;
        }
        response = await fetch(url, { ...options, headers: newHeaders });
      } catch (error) {
        // Refresh failed - return original 401 response
        return response;
      }
    }
  }

  return response;
};

export const api = {
  getTenants: async (): Promise<Tenant[]> => {
    const response = await fetchWithAuth(`${API_URL}/tenants/`, {
      headers: getHeaders(false, true),
    });
    if (!response.ok) throw new Error('Failed to fetch tenants');
    const data = await response.json();
    // Map backend fields to frontend types if necessary (e.g. snake_case to camelCase)
    // Django Rest Framework defaults to snake_case, but our types are camelCase.
    // We need to map them or configure DRF to use camelCase.
    // For now, let's map manually to be safe and explicit.
    return data.map((item: any) => ({
      ...item,
      id: String(item.id), // Ensure ID is always a string
      propertyUnit: item.property_unit,
      leaseStart: item.lease_start,
      leaseEnd: item.lease_end,
      rentAmount: parseFloat(item.rent_amount),
      deposit: parseFloat(item.deposit),
      balance: parseFloat(item.balance),
      creditScore: item.credit_score,
      backgroundCheckStatus: item.background_check_status,
      applicationData: item.application_data,
      leaseStatus: item.lease_status,
      signedLeaseUrl: item.signed_lease_url,
      photoIdFiles: item.photo_id_files || [],
      incomeVerificationFiles: item.income_verification_files || [],
      backgroundCheckFiles: item.background_check_files || []
    }));
  },

  getPayments: async (): Promise<Payment[]> => {
    const response = await fetchWithAuth(`${API_URL}/payments/`, {
      headers: getHeaders(false, true),
    });
    if (!response.ok) throw new Error('Failed to fetch payments');
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      tenantId: String(item.tenant),
      amount: parseFloat(item.amount),
      proofOfPaymentFiles: item.proof_of_payment_files || []
    }));
  },

  createPayment: async (paymentData: Partial<Payment> & { proofFiles?: File[] }): Promise<Payment & { invoice_email_sent?: boolean }> => {
    const hasProofFiles = paymentData.proofFiles && paymentData.proofFiles.length > 0;
    
    let body: FormData | string;
    let headers: HeadersInit;
    
    if (hasProofFiles) {
      const formData = new FormData();
      formData.append('tenant', paymentData.tenantId!);
      formData.append('amount', String(paymentData.amount ?? 0));
      formData.append('date', paymentData.date!);
      formData.append('status', paymentData.status ?? 'Pending');
      formData.append('type', paymentData.type ?? 'Rent');
      formData.append('method', paymentData.method!);
      if (paymentData.reference) formData.append('reference', paymentData.reference);
      paymentData.proofFiles!.forEach((file: File) => {
        formData.append('proof_of_payment_files_upload', file);
      });
      body = formData;
      headers = getHeaders(false);
    } else {
      const backendData = {
        tenant: paymentData.tenantId,
        amount: paymentData.amount?.toString(),
        date: paymentData.date,
        status: paymentData.status,
        type: paymentData.type,
        method: paymentData.method,
        reference: paymentData.reference || null,
      };
      body = JSON.stringify(backendData);
      headers = getHeaders();
    }
    
    const response = await fetchWithAuth(`${API_URL}/payments/`, {
      method: 'POST',
      headers,
      body,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create payment' }));
      throw new Error(error.detail || error.message || 'Failed to create payment');
    }
    
    const data = await response.json();
    return {
      ...data,
      id: String(data.id),
      tenantId: String(data.tenant),
      amount: parseFloat(data.amount),
      invoice_email_sent: data.invoice_email_sent,
    };
  },

  updatePayment: async (id: string, paymentData: Partial<Payment>): Promise<Payment> => {
    const backendData: any = {};
    if (paymentData.tenantId) backendData.tenant = paymentData.tenantId;
    if (paymentData.amount !== undefined) backendData.amount = paymentData.amount.toString();
    if (paymentData.date) backendData.date = paymentData.date;
    if (paymentData.status) backendData.status = paymentData.status;
    if (paymentData.type) backendData.type = paymentData.type;
    if (paymentData.method) backendData.method = paymentData.method;
    if (paymentData.reference !== undefined) backendData.reference = paymentData.reference || null;
    
    const response = await fetchWithAuth(`${API_URL}/payments/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(backendData),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update payment' }));
      throw new Error(error.detail || error.message || 'Failed to update payment');
    }
    
    const data = await response.json();
    return {
      ...data,
      id: String(data.id),
      tenantId: String(data.tenant),
      amount: parseFloat(data.amount),
    };
  },

  deletePayment: async (id: string): Promise<void> => {
    const response = await fetchWithAuth(`${API_URL}/payments/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(false),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete payment' }));
      throw new Error(error.detail || error.message || 'Failed to delete payment');
    }
  },

  sendPaymentReceipt: async (paymentId: string): Promise<{ status: string; message: string; receipt_email_sent?: boolean }> => {
    const response = await fetchWithAuth(`${API_URL}/payments/${paymentId}/send-receipt/`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to send receipt email' }));
      throw new Error(error.detail || error.message || 'Failed to send receipt email');
    }
    return await response.json();
  },

  getMaintenanceRequests: async (): Promise<MaintenanceRequest[]> => {
    try {
      const response = await fetchWithAuth(`${API_URL}/maintenance/`, {
        headers: getHeaders(false, true),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch maintenance requests: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      // Handle case where data might be null or not an array
      if (!data || !Array.isArray(data)) {
        return [];
      }
      return data.map((item: any) => ({
        ...item,
        id: String(item.id), // Ensure ID is always a string
        tenantId: String(item.tenant), // Convert tenant ForeignKey ID to string
        createdAt: item.created_at,
        assignedTo: item.assigned_to,
        completionAttachments: item.completion_attachments || [],
        images: item.images || [],
        updates: item.updates || []
      }));
    } catch (error: any) {
      // If it's already our error, rethrow it
      if (error.message?.includes('Failed to fetch maintenance requests')) {
        throw error;
      }
      // Otherwise wrap it
      throw new Error(`Failed to fetch maintenance requests: ${error.message || 'Network error'}`);
    }
  },

  getListings: async (): Promise<Listing[]> => {
    const response = await fetch(`${API_URL}/listings/`, {
      headers: getHeaders(false),
    });
    if (!response.ok) throw new Error('Failed to fetch listings');
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      price: parseFloat(item.price),
      baths: parseFloat(item.baths)
    }));
  },

  // Helper function to map frontend camelCase to backend snake_case
  mapTenantToBackend: (tenant: Partial<Tenant>): any => {
    // Convert empty strings to null for dates
    const leaseStart = tenant.leaseStart && tenant.leaseStart.trim() !== '' ? tenant.leaseStart : null;
    const leaseEnd = tenant.leaseEnd && tenant.leaseEnd.trim() !== '' ? tenant.leaseEnd : null;
    
    return {
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status,
      property_unit: tenant.propertyUnit,
      lease_start: leaseStart,
      lease_end: leaseEnd,
      rent_amount: tenant.rentAmount?.toString(),
      deposit: tenant.deposit?.toString(),
      // balance is auto-calculated on the backend, don't send it
      credit_score: tenant.creditScore || null,
      background_check_status: tenant.backgroundCheckStatus || null,
      application_data: tenant.applicationData || null,
      lease_status: tenant.leaseStatus || null,
      signed_lease_url: tenant.signedLeaseUrl || null,
    };
  },

  createTenant: async (tenantData: any): Promise<Tenant> => {
    // Check if we have files to upload
    const hasFiles = (tenantData.photoIdFiles && tenantData.photoIdFiles.length > 0) ||
                     (tenantData.incomeVerificationFiles && tenantData.incomeVerificationFiles.length > 0) ||
                     tenantData.backgroundCheckFile;
    
    let body: FormData | string;
    let headers: HeadersInit;
    
    if (hasFiles) {
      // Use FormData for file upload
      const formData = new FormData();
      
      // Add basic tenant fields
      formData.append('name', tenantData.name || '');
      formData.append('email', tenantData.email || '');
      formData.append('phone', tenantData.phone || '');
      formData.append('status', tenantData.status || 'Applicant');
      formData.append('property_unit', tenantData.propertyUnit || '');
      formData.append('rent_amount', String(tenantData.rentAmount || 0));
      formData.append('deposit', String(tenantData.deposit || 0));
      // balance is auto-calculated on the backend, don't send it
      
      // Add application data as JSON string
      if (tenantData.applicationData) {
        formData.append('application_data', JSON.stringify(tenantData.applicationData));
      }
      
      // Add file uploads
      if (tenantData.photoIdFiles && tenantData.photoIdFiles.length > 0) {
        tenantData.photoIdFiles.forEach((file: File) => {
          formData.append('photo_id_files_upload', file);
        });
      }
      
      if (tenantData.incomeVerificationFiles && tenantData.incomeVerificationFiles.length > 0) {
        tenantData.incomeVerificationFiles.forEach((file: File) => {
          formData.append('income_verification_files_upload', file);
        });
      }
      
      if (tenantData.backgroundCheckFile) {
        formData.append('background_check_files_upload', tenantData.backgroundCheckFile);
      }
      
      body = formData;
      headers = {}; // Don't set Content-Type for FormData, browser will set it with boundary
    } else {
      // Use JSON for regular submission without files
      const backendData = api.mapTenantToBackend(tenantData);
      body = JSON.stringify(backendData);
      headers = getHeaders();
    }
    
    const response = await fetch(`${API_URL}/tenants/`, {
      method: 'POST',
      headers,
      body,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to create tenant' }));
      // Handle Django REST Framework error format
      const errorMessage = errorData.detail || errorData.message || 
        (errorData.non_field_errors && errorData.non_field_errors[0]) ||
        (typeof errorData === 'object' && Object.keys(errorData).length > 0 
          ? JSON.stringify(errorData) 
          : 'Application Failed');
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    // Map backend response to frontend format
    return {
      ...data,
      id: String(data.id),
      propertyUnit: data.property_unit,
      leaseStart: data.lease_start,
      leaseEnd: data.lease_end,
      rentAmount: parseFloat(data.rent_amount),
      deposit: parseFloat(data.deposit),
      balance: parseFloat(data.balance),
      creditScore: data.credit_score,
      backgroundCheckStatus: data.background_check_status,
      applicationData: data.application_data,
      leaseStatus: data.lease_status,
      signedLeaseUrl: data.signed_lease_url,
    };
  },

  updateTenant: async (id: string, tenantData: Partial<Tenant>): Promise<Tenant> => {
    const backendData = api.mapTenantToBackend(tenantData);
    const response = await fetchWithAuth(`${API_URL}/tenants/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(backendData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update tenant' }));
      throw new Error(error.detail || error.message || 'Failed to update tenant');
    }
    const data = await response.json();
    console.log('API updateTenant response:', data);
    console.log('Parsed balance:', parseFloat(data.balance));
    // Map backend response to frontend format
    return {
      ...data,
      id: String(data.id), // Ensure ID is always a string
      propertyUnit: data.property_unit,
      leaseStart: data.lease_start,
      leaseEnd: data.lease_end,
      rentAmount: parseFloat(data.rent_amount),
      deposit: parseFloat(data.deposit),
      balance: parseFloat(data.balance),
      creditScore: data.credit_score,
      backgroundCheckStatus: data.background_check_status,
      applicationData: data.application_data,
      leaseStatus: data.lease_status,
      signedLeaseUrl: data.signed_lease_url,
    };
  },

  deleteTenant: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/tenants/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(false),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete tenant' }));
      throw new Error(error.detail || error.message || 'Failed to delete tenant');
    }
  },

  // Helper function to map frontend camelCase to backend snake_case for maintenance requests
  mapMaintenanceToBackend: (request: Partial<MaintenanceRequest>): any => {
    return {
      tenant: request.tenantId,
      category: request.category,
      description: request.description,
      status: request.status,
      priority: request.priority,
      images: request.images || [],
      updates: request.updates || [],
      assigned_to: request.assignedTo || null,
      completion_attachments: request.completionAttachments || [],
    };
  },

  createMaintenanceRequest: async (requestData: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> => {
    const backendData = api.mapMaintenanceToBackend(requestData);
    const response = await fetch(`${API_URL}/maintenance/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(backendData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create maintenance request' }));
      throw new Error(error.detail || error.message || 'Failed to create maintenance request');
    }
    const data = await response.json();
    // Map backend response to frontend format
    return {
      ...data,
      id: String(data.id),
      tenantId: String(data.tenant),
      createdAt: data.created_at,
      assignedTo: data.assigned_to,
      completionAttachments: data.completion_attachments || [],
      images: data.images || [],
      updates: data.updates || []
    };
  },

  updateMaintenanceRequest: async (id: string, requestData: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> => {
    const backendData = api.mapMaintenanceToBackend(requestData);
    const response = await fetch(`${API_URL}/maintenance/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(backendData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update maintenance request' }));
      throw new Error(error.detail || error.message || 'Failed to update maintenance request');
    }
    const data = await response.json();
    // Map backend response to frontend format
    return {
      ...data,
      id: String(data.id),
      tenantId: String(data.tenant),
      createdAt: data.created_at,
      assignedTo: data.assigned_to,
      completionAttachments: data.completion_attachments || [],
      images: data.images || [],
      updates: data.updates || []
    };
  },

  deleteMaintenanceRequest: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/maintenance/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(false),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete maintenance request' }));
      throw new Error(error.detail || error.message || 'Failed to delete maintenance request');
    }
  },

  // Property CRUD operations
  getProperties: async (): Promise<Property[]> => {
    // First try with auth if available, but handle 401 gracefully
    let response = await fetch(`${API_URL}/properties/`, {
      headers: getHeaders(false, true),
    });
    
    // If 401, clear invalid tokens and retry without auth (public endpoint)
    if (response.status === 401) {
      clearInvalidTokens();
      response = await fetch(`${API_URL}/properties/`, {
        headers: getHeaders(false, false),
      });
    }
    
    if (!response.ok) throw new Error('Failed to fetch properties');
    const data = await response.json();
    return data.map((item: any) => {
      // Handle display_image from serializer (returns uploaded file URL or external URL)
      const imageUrl = item.display_image || item.image || item.image_url || undefined;
      return {
        ...item,
        id: String(item.id), // Ensure ID is always a string
        price: item.price ? parseFloat(item.price) : undefined,
        image: imageUrl,
        furnishingType: item.furnishing_type || undefined,
        furnishingsBreakdown: item.furnishings_breakdown || [],
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    });
  },

  createProperty: async (propertyData: Partial<Property>, imageFile?: File): Promise<Property> => {
    let body: FormData | string;
    let headers: HeadersInit;

    if (imageFile) {
      // Use FormData for file upload
      const formData = new FormData();
      formData.append('name', propertyData.name || '');
      formData.append('address', propertyData.address || '');
      formData.append('city', propertyData.city || '');
      formData.append('state', propertyData.state || '');
      formData.append('units', String(propertyData.units || 1));
      if (propertyData.price !== undefined) formData.append('price', String(propertyData.price));
      formData.append('bedrooms', String(propertyData.bedrooms || 2));
      formData.append('bathrooms', String(propertyData.bathrooms || 2));
      formData.append('square_footage', String(propertyData.square_footage || 1000));
      if (propertyData.furnishingType) formData.append('furnishing_type', propertyData.furnishingType);
      if (propertyData.furnishingsBreakdown?.length) formData.append('furnishings_breakdown', JSON.stringify(propertyData.furnishingsBreakdown));
      formData.append('image', imageFile);
      formData.append('image_url', ''); // Clear URL when uploading file
      body = formData;
      headers = {}; // Don't set Content-Type, browser will set it with boundary
    } else {
      // Use JSON for URL or no image
      body = JSON.stringify({
        name: propertyData.name,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        units: propertyData.units || 1,
        price: propertyData.price !== undefined ? propertyData.price : null,
        bedrooms: propertyData.bedrooms || 2,
        bathrooms: propertyData.bathrooms || 2,
        square_footage: propertyData.square_footage || 1000,
        furnishing_type: propertyData.furnishingType || null,
        furnishings_breakdown: propertyData.furnishingsBreakdown || [],
        image_url: propertyData.image || null, // Use image_url for URL input
      });
      headers = {
        'Content-Type': 'application/json',
      };
    }

    const authHeader = getAuthHeader();
    if (authHeader && typeof headers === 'object' && !Array.isArray(headers)) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${API_URL}/properties/`, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create property' }));
      throw new Error(error.detail || error.message || 'Failed to create property');
    }
    const data = await response.json();
    // Handle display_image from serializer (returns uploaded file URL or external URL)
    const imageUrl = data.display_image || data.image || data.image_url || undefined;
    return {
      ...data,
      id: String(data.id),
      price: data.price ? parseFloat(data.price) : undefined,
      image: imageUrl,
      furnishingType: data.furnishing_type || undefined,
      furnishingsBreakdown: data.furnishings_breakdown || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  updateProperty: async (id: string, propertyData: Partial<Property>, imageFile?: File): Promise<Property> => {
    let body: FormData | string;
    let headers: HeadersInit;

    if (imageFile) {
      // Use FormData for file upload
      const formData = new FormData();
      if (propertyData.name) formData.append('name', propertyData.name);
      if (propertyData.address) formData.append('address', propertyData.address);
      if (propertyData.city) formData.append('city', propertyData.city);
      if (propertyData.state) formData.append('state', propertyData.state);
      if (propertyData.units !== undefined) formData.append('units', String(propertyData.units));
      if (propertyData.price !== undefined) formData.append('price', String(propertyData.price));
      if (propertyData.bedrooms !== undefined) formData.append('bedrooms', String(propertyData.bedrooms));
      if (propertyData.bathrooms !== undefined) formData.append('bathrooms', String(propertyData.bathrooms));
      if (propertyData.square_footage !== undefined) formData.append('square_footage', String(propertyData.square_footage));
      if (propertyData.furnishingType !== undefined) formData.append('furnishing_type', propertyData.furnishingType);
      if (propertyData.furnishingsBreakdown !== undefined) formData.append('furnishings_breakdown', JSON.stringify(propertyData.furnishingsBreakdown));
      formData.append('image', imageFile);
      formData.append('image_url', ''); // Clear URL when uploading file
      body = formData;
      headers = {}; // Don't set Content-Type, browser will set it with boundary
    } else {
      // Use JSON for URL or no image
      const jsonData: any = {};
      if (propertyData.name !== undefined) jsonData.name = propertyData.name;
      if (propertyData.address !== undefined) jsonData.address = propertyData.address;
      if (propertyData.city !== undefined) jsonData.city = propertyData.city;
      if (propertyData.state !== undefined) jsonData.state = propertyData.state;
      if (propertyData.units !== undefined) jsonData.units = propertyData.units;
      if (propertyData.price !== undefined) jsonData.price = propertyData.price;
      if (propertyData.bedrooms !== undefined) jsonData.bedrooms = propertyData.bedrooms;
      if (propertyData.bathrooms !== undefined) jsonData.bathrooms = propertyData.bathrooms;
      if (propertyData.square_footage !== undefined) jsonData.square_footage = propertyData.square_footage;
      if (propertyData.image !== undefined) {
        jsonData.image_url = propertyData.image || null; // Use image_url for URL input
      }
      if (propertyData.furnishingType !== undefined) jsonData.furnishing_type = propertyData.furnishingType;
      if (propertyData.furnishingsBreakdown !== undefined) jsonData.furnishings_breakdown = propertyData.furnishingsBreakdown;
      body = JSON.stringify(jsonData);
      headers = {
        'Content-Type': 'application/json',
      };
    }

    const authHeader = getAuthHeader();
    if (authHeader && typeof headers === 'object' && !Array.isArray(headers)) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${API_URL}/properties/${id}/`, {
      method: 'PATCH',
      headers,
      body,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update property' }));
      throw new Error(error.detail || error.message || 'Failed to update property');
    }
    const data = await response.json();
    // Handle display_image from serializer (returns uploaded file URL or external URL)
    const imageUrl = data.display_image || data.image || data.image_url || undefined;
    return {
      ...data,
      id: String(data.id),
      price: data.price ? parseFloat(data.price) : undefined,
      image: imageUrl,
      furnishingType: data.furnishing_type || undefined,
      furnishingsBreakdown: data.furnishings_breakdown || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  deleteProperty: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/properties/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(false),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete property' }));
      throw new Error(error.detail || error.message || 'Failed to delete property');
    }
  },

  // Lease Template APIs
  getLeaseTemplates: async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/lease-templates/`, {
      headers: getHeaders(false, false),
    });
    if (!response.ok) throw new Error('Failed to fetch lease templates');
    return await response.json();
  },

  createLeaseTemplate: async (templateData: { name: string; content: string; is_active?: boolean }): Promise<any> => {
    const response = await fetch(`${API_URL}/lease-templates/`, {
      method: 'POST',
      headers: getHeaders(true, false), // Public endpoint, no auth needed
      body: JSON.stringify(templateData),
    });
    if (!response.ok) throw new Error('Failed to create lease template');
    return await response.json();
  },

  // Lease Generation API
  generateLease: async (tenantId: string, templateId?: string, customContent?: string): Promise<any> => {
    const body: any = {
      tenant_id: tenantId,
    };
    if (templateId) {
      body.template_id = templateId;
    }
    if (customContent) {
      body.custom_content = customContent;
    }
    const response = await fetch(`${API_URL}/legal-documents/generate_lease/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to generate lease' }));
      throw new Error(error.detail || error.message || 'Failed to generate lease');
    }
    return await response.json();
  },

  // Update legal document (e.g. for manual signing)
  updateLegalDocument: async (id: string, data: any): Promise<any> => {
    const response = await fetchWithAuth(`${API_URL}/legal-documents/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update legal document' }));
      throw new Error(error.detail || error.message || 'Failed to update legal document');
    }
    return await response.json();
  },

  // Send lease via Dropbox Sign
  sendLeaseDocuSign: async (legalDocumentId: string, createDraft: boolean = false): Promise<any> => {
    const response = await fetchWithAuth(
      `${API_URL}/legal-documents/${legalDocumentId}/send_dropbox_sign/`,
      {
        method: 'POST',
        headers: getHeaders(true, true),
        body: JSON.stringify({ create_draft: createDraft }),
      }
    );
    if (!response.ok) {
      let error: any = { detail: 'Failed to send lease via Dropbox Sign' };
      try {
        error = await response.json();
      } catch {
        // keep default
      }
      throw new Error(error.detail || error.message || 'Failed to send lease via Dropbox Sign');
    }
    return await response.json();
  },

  // Check lease status (Dropbox Sign)
  checkLeaseStatus: async (legalDocumentId: string): Promise<any> => {
    const response = await fetchWithAuth(
      `${API_URL}/legal-documents/${legalDocumentId}/check_status/`,
      {
        method: 'POST',
        headers: getHeaders(false, true),
      }
    );
    if (!response.ok) {
      let error: any = { detail: 'Failed to check lease status' };
      try {
        error = await response.json();
      } catch {
        // keep default
      }
      throw new Error(error.detail || error.message || 'Failed to check lease status');
    }
    const data = await response.json();
    return {
      ...data,
      id: String(data.id),
      tenantId: String(data.tenant),
      pdfUrl: data.pdf_url,
      dropboxSignSignatureRequestId: data.dropbox_sign_signature_request_id ?? data.docusign_envelope_id,
      dropboxSignSigningUrl: data.dropbox_sign_signing_url ?? data.docusign_signing_url,
      signedPdfUrl: data.signed_pdf_url,
      signedAt: data.signed_at,
    };
  },

  // Get legal documents for a tenant (uses auth and same API base URL)
  getLegalDocuments: async (tenantId?: string): Promise<any[]> => {
    let url = `${API_URL}/legal-documents/`;
    if (tenantId) {
      url += `?tenant=${tenantId}`;
    }
    const response = await fetchWithAuth(url, {
      headers: getHeaders(false),
    });
    if (!response.ok) throw new Error('Failed to fetch legal documents');
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      id: String(item.id),
      tenantId: String(item.tenant),
      pdfUrl: item.pdf_url,
      dropboxSignSignatureRequestId: item.dropbox_sign_signature_request_id ?? item.docusign_envelope_id,
      dropboxSignSigningUrl: item.dropbox_sign_signing_url ?? item.docusign_signing_url,
      signedPdfUrl: item.signed_pdf_url,
      signedAt: item.signed_at,
    }));
  },

  // Fetch lease/legal document PDF with auth (for viewing in portal without 401)
  getLegalDocumentPdfAsBlob: async (documentId: string): Promise<Blob> => {
    const response = await fetchWithAuth(`${API_URL}/legal-documents/${documentId}/pdf/`, {
      headers: getHeaders(false),
    });
    if (!response.ok) throw new Error('Failed to load PDF');
    return response.blob();
  },

  // Generate and send legal notice to tenant
  generateLegalNotice: async (tenantId: string, noticeType: string): Promise<any> => {
    const response = await fetchWithAuth(`${API_URL}/legal-documents/generate_notice/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        tenant_id: tenantId,
        notice_type: noticeType,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to generate and send notice' }));
      throw new Error(error.detail || error.message || 'Failed to generate and send notice');
    }
    
    const data = await response.json();
    return {
      ...data,
      id: String(data.id),
      tenantId: String(data.tenant),
      pdfUrl: data.pdf_url,
      notice_email_sent: data.notice_email_sent,
    };
  },

  // Check Application Status
  checkApplicationStatus: async (email: string, phone: string): Promise<any> => {
    const response = await fetch(`${API_URL}/tenants/check_status/`, {
      method: 'POST',
      headers: getHeaders(true, false), // Public endpoint
      body: JSON.stringify({ email, phone }),
    });
    if (!response.ok) {
      if (response.status === 404) return null; // Not found
      // Try to parse error message from response
      let errorMessage = 'Failed to check status';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use default message
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  },

  // Get current user's tenant
  getMyTenant: async (): Promise<Tenant> => {
    const response = await fetchWithAuth(`${API_URL}/tenants/me/`, {
      headers: getHeaders(false, true),
    });
    if (!response.ok) {
      // If 401 after refresh attempt, clear invalid tokens - user is not authenticated
      if (response.status === 401) {
        clearInvalidTokens();
        const error = await response.json().catch(() => ({ detail: 'Not authenticated' }));
        throw new Error(error.detail || error.message || 'Not authenticated');
      }
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch tenant' }));
      throw new Error(error.detail || error.message || 'Failed to fetch tenant');
    }
    const data = await response.json();
    // Map backend response to frontend format
    return {
      ...data,
      id: String(data.id),
      propertyUnit: data.property_unit,
      leaseStart: data.lease_start,
      leaseEnd: data.lease_end,
      rentAmount: parseFloat(data.rent_amount),
      deposit: parseFloat(data.deposit),
      balance: parseFloat(data.balance),
      creditScore: data.credit_score,
      backgroundCheckStatus: data.background_check_status,
      applicationData: data.application_data,
      leaseStatus: data.lease_status,
      signedLeaseUrl: data.signed_lease_url,
    };
  },

  // Contact Manager (email-only)
  sendContactManagerMessage: async (payload: { message: string; tenant_id?: string; sender_name?: string; sender_email?: string; }): Promise<{ status: string }> => {
    const response = await fetchWithAuth(`${API_URL}/contact-manager/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to send message' }));
      throw new Error(error.error || error.detail || 'Failed to send message');
    }
    return await response.json();
  },
};
