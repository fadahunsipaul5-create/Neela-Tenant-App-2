import React from 'react';
import { Tenant, UserStatus } from '../types';
import {
  FileText, User, Check, FileSignature, ArrowLeft, Clock, AlertCircle, CheckCircle, Building2, Mail, Home
} from 'lucide-react';

export interface StatusTrackerProps {
  status: UserStatus;
  leaseStatus?: string;
}

export const StatusTracker: React.FC<StatusTrackerProps> = ({ status, leaseStatus }) => {
  const steps = [
    { id: 'applicant_pending', label: 'Application Submitted', icon: FileText },
    { id: 'reviewing', label: 'Under Review', icon: User },
    { id: 'applicant_approved', label: 'Approved', icon: Check },
    { id: 'resident', label: 'Lease Signed', icon: FileSignature },
  ];

  const getStepState = (stepId: string) => {
    if (status === 'resident') return 'completed';
    
    if (status === 'applicant_approved') {
      // If we are approved, 'Approved' step should be active/completed
      if (stepId === 'applicant_pending' || stepId === 'reviewing') return 'completed';
      if (stepId === 'applicant_approved') return 'completed'; // Or 'current' depending on design, but 'completed' usually implies "done"
      
      if (stepId === 'resident') {
         return leaseStatus === 'Signed' ? 'completed' : 'pending';
      }
      return 'completed';
    }
    
    // If pending, submitted is done, reviewing is current
    if (status === 'applicant_pending') {
      if (stepId === 'applicant_pending') return 'completed';
      if (stepId === 'reviewing') return 'current';
      return 'pending';
    }
    
    return 'pending';
  };

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10"></div>
        {steps.map((step) => {
          const state = getStepState(step.id);
          const isCompleted = state === 'completed';
          const isCurrent = state === 'current';
          
          return (
            <div key={step.id} className="flex flex-col items-center bg-slate-50 px-2">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 
                  isCurrent ? 'bg-indigo-600 border-indigo-600 text-white' : 
                  'bg-white border-slate-300 text-slate-300'}
              `}>
                <step.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium mt-2 ${isCurrent || isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface StatusTrackerViewProps {
  tempTenant: Tenant;
  setView: (view: string) => void;
}

export const StatusTrackerView: React.FC<StatusTrackerViewProps> = ({ tempTenant, setView }) => {
  // Map tenant status to UserStatus for StatusTracker
  const mapTenantStatusToUserStatus = (tenantStatus: any): UserStatus => {
    if (tenantStatus === 'Active') return 'resident';
    if (tenantStatus === 'Approved') return 'applicant_approved';
    if (tenantStatus === 'Applicant') return 'applicant_pending';
    if (String(tenantStatus) === 'Resident') return 'resident';
    if (tenantStatus === 'Past') return 'resident';
    return 'applicant_pending';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setView('check_status')}
                aria-label="Back to check status"
                className="flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto sm:py-2 sm:px-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus-visible:ring-2 transition-colors duration-200 flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden />
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate">Application Status</h2>
            </div>
            <button
              type="button"
              onClick={() => setView('listings')}
              aria-label="Back to Home"
              className="flex items-center gap-2 py-2.5 sm:py-3 px-4 sm:px-5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus-visible:ring-4 transition-all duration-200 group transform hover:-translate-y-0.5"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" aria-hidden />
              <span>Back to Home</span>
            </button>
          </div>
          
          <div className="p-8 space-y-8">
            {/* Tenant Info */}
            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Applicant Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Name</p>
                  <p className="font-medium text-slate-800">{tempTenant.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium text-slate-800">{tempTenant.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium text-slate-800">{tempTenant.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    tempTenant.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                    tempTenant.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                    tempTenant.status === 'Applicant' ? 'bg-blue-100 text-blue-800' :
                    String(tempTenant.status) === 'Declined' ? 'bg-red-100 text-red-800' :
                    tempTenant.status === 'Past' ? 'bg-slate-100 text-slate-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {tempTenant.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-6">Application Timeline</h3>
              <StatusTracker 
                status={mapTenantStatusToUserStatus(tempTenant.status)}
                leaseStatus={tempTenant.leaseStatus} 
              />
            </div>

            {/* Status-specific messages */}
            {(tempTenant.status === 'Active' || tempTenant.status === 'Past') && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-12 h-12 text-emerald-600 mb-4" />
                <h3 className="text-2xl font-bold text-emerald-900 mb-2">
                  {tempTenant.status === 'Active' ? 'Welcome! You\'re All Set' : 'Former Resident'}
                </h3>
                <p className="text-emerald-800 mb-6 max-w-lg">
                  {tempTenant.status === 'Active' 
                    ? 'Your application has been approved and you are now an active resident. You can access your resident portal to manage payments, maintenance requests, and more.'
                    : 'You were previously a resident at this property.'}
                </p>
                {tempTenant.propertyUnit && (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-sm text-emerald-800 flex items-center gap-3">
                    <Building2 className="w-5 h-5 flex-shrink-0" />
                    <span>Unit: {tempTenant.propertyUnit}</span>
                  </div>
                )}
              </div>
            )}

            {tempTenant.status === 'Approved' && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-12 h-12 text-emerald-600 mb-4" />
                <h3 className="text-2xl font-bold text-emerald-900 mb-2">Application Approved!</h3>
                <p className="text-emerald-800 mb-6 max-w-lg">
                  Your application has been approved. A lease agreement will be sent to your email address. Please check your inbox to review and sign.
                </p>
                {tempTenant.leaseStatus && (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-sm text-emerald-800 flex items-center gap-3">
                    <Mail className="w-5 h-5 flex-shrink-0" />
                    <span>Lease Status: {tempTenant.leaseStatus}</span>
                  </div>
                )}
              </div>
            )}

            {tempTenant.status === 'Applicant' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center">
                <Clock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-blue-900 mb-2">Application Under Review</h3>
                <p className="text-blue-700">We are processing your application and background check. This usually takes 24-48 hours.</p>
              </div>
            )}

            {String(tempTenant.status) === 'Declined' && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-red-900 mb-2">Application Not Approved</h3>
                <p className="text-red-700">Unfortunately, your application was not approved at this time. Please contact us if you have any questions.</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setView('listings')}
                aria-label="Back to Home"
                className="flex items-center justify-center gap-2 py-3 sm:py-3.5 px-5 sm:px-6 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus-visible:ring-4 transition-all duration-200 group transform hover:-translate-y-0.5"
              >
                <Home className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" aria-hidden />
                <span>Back to Home</span>
              </button>
              <button
                type="button"
                onClick={() => setView('check_status')}
                aria-label="Check another application"
                className="flex items-center justify-center gap-2 py-3 sm:py-3.5 px-5 sm:px-6 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus-visible:ring-4 transition-all duration-200"
              >
                Check Another Application
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

