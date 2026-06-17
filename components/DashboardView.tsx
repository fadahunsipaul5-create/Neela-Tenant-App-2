
// import React from 'react';
// import { 
//   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
//   PieChart, Pie, Cell 
// } from 'recharts';
// import { DollarSign, AlertCircle, CheckCircle2, Users, FileText, Building2, Home, Settings } from 'lucide-react';
// import { Tenant, Payment, MaintenanceRequest, TenantStatus, Property } from '../types';

// interface DashboardProps {
//   tenants: Tenant[];
//   payments: Payment[];
//   maintenance: MaintenanceRequest[];
//   properties: Property[];
//   onReviewApplications: () => void;
// }

// const DashboardView: React.FC<DashboardProps> = ({ tenants, payments, maintenance, properties, onReviewApplications }) => {
//   // Derived Metrics
//   const totalRevenue = payments
//     .filter(p => p.status === 'Paid')
//     .reduce((acc, curr) => acc + curr.amount, 0);
  
//   const overdueAmount = tenants.reduce((acc, curr) => acc + curr.balance, 0);
  
//   const occupancyRate = Math.round((tenants.filter(t => t.status === TenantStatus.ACTIVE).length / tenants.length) * 100) || 0;
  
//   const openTickets = maintenance.filter(m => m.status !== 'Resolved').length;
//   const newApplications = tenants.filter(t => t.status === TenantStatus.APPLICANT).length;

//   // Chart Data
//   const revenueData = [
//     { name: 'Jan', amount: 4000 },
//     { name: 'Feb', amount: 3500 },
//     { name: 'Mar', amount: 4200 },
//     { name: 'Apr', amount: 3800 },
//     { name: 'May', amount: totalRevenue }, // Simulating current month
//   ];

//   const ticketData = [
//     { name: 'Open', value: maintenance.filter(m => m.status === 'Open').length },
//     { name: 'In Progress', value: maintenance.filter(m => m.status === 'In Progress').length },
//     { name: 'Resolved', value: maintenance.filter(m => m.status === 'Resolved').length },
//   ];

//   const COLORS = ['#ef4444', '#f59e0b', '#10b981'];

//   return (
//     <div className="space-y-6 animate-fade-in">
//       {newApplications > 0 && (
//         <div className="bg-blue-600 text-white p-4 rounded-xl shadow-md flex items-center justify-between">
//            <div className="flex items-center gap-3">
//               <div className="p-2 bg-white/20 rounded-lg"><FileText className="w-5 h-5"/></div>
//               <div>
//                  <p className="font-bold">New Applications Received</p>
//                  <p className="text-sm text-blue-100">You have {newApplications} pending application(s) to review.</p>
//               </div>
//            </div>
//            <button 
//              onClick={onReviewApplications}
//              className="px-4 py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 text-sm"
//            >
//               Review Now
//            </button>
//         </div>
//       )}

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//         <StatCard 
//           title="Monthly Revenue" 
//           value={`$${totalRevenue.toLocaleString()}`} 
//           icon={DollarSign} 
//           color="text-emerald-600" 
//           bg="bg-emerald-50"
//         />
//         <StatCard 
//           title="Outstanding Rent" 
//           value={`$${overdueAmount.toLocaleString()}`} 
//           icon={AlertCircle} 
//           color="text-rose-600" 
//           bg="bg-rose-50"
//         />
//         <StatCard 
//           title="Occupancy Rate" 
//           value={`${occupancyRate}%`} 
//           icon={Users} 
//           color="text-blue-600" 
//           bg="bg-blue-50"
//         />
//         <StatCard 
//           title="Open Tickets" 
//           value={openTickets.toString()} 
//           icon={CheckCircle2} 
//           color="text-orange-600" 
//           bg="bg-orange-50"
//         />
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
//           <h3 className="text-lg font-semibold text-slate-800 mb-4">Revenue Overview</h3>
//           <div className="h-64">
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={revenueData}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
//                 <XAxis dataKey="name" stroke="#64748b" />
//                 <YAxis stroke="#64748b" />
//                 <Tooltip 
//                   contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
//                 />
//                 <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
//           <h3 className="text-lg font-semibold text-slate-800 mb-4">Maintenance Status</h3>
//           <div className="h-64">
//             <ResponsiveContainer width="100%" height="100%">
//               <PieChart>
//                 <Pie
//                   data={ticketData}
//                   cx="50%"
//                   cy="50%"
//                   innerRadius={60}
//                   outerRadius={80}
//                   paddingAngle={5}
//                   dataKey="value"
//                 >
//                   {ticketData.map((entry, index) => (
//                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                   ))}
//                 </Pie>
//                 <Tooltip />
//               </PieChart>
//             </ResponsiveContainer>
//             <div className="flex justify-center gap-4 mt-2 text-xs text-slate-600">
//               <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-rose-500 mr-1"></span>Open</div>
//               <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1"></span>In Progress</div>
//               <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Resolved</div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Property Portfolio Section */}
//       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
//             <Building2 className="w-5 h-5 text-indigo-600" />
//             Property Portfolio
//           </h3>
//           <a 
//             href="#settings" 
//             onClick={(e) => {
//               e.preventDefault();
//               window.location.hash = 'settings';
//             }}
//             className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
//           >
//             Manage Properties
//             <Settings className="w-4 h-4" />
//           </a>
//         </div>
//         {properties.length === 0 ? (
//           <div className="text-center py-8 text-slate-500">
//             <Home className="w-12 h-12 mx-auto mb-3 text-slate-300" />
//             <p>No properties yet. Add your first property in Settings.</p>
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {properties.slice(0, 6).map(prop => (
//               <div key={prop.id} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
//                 {prop.image ? (
//                   <div className="h-32 bg-slate-200 overflow-hidden">
//                     <img 
//                       src={prop.image} 
//                       alt={prop.name}
//                       className="w-full h-full object-cover"
//                       onError={(e) => {
//                         (e.target as HTMLImageElement).style.display = 'none';
//                         (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><Home class="w-8 h-8 text-slate-400" /></div>';
//                       }}
//                     />
//                   </div>
//                 ) : (
//                   <div className="h-32 bg-slate-200 flex items-center justify-center">
//                     <Home className="w-8 h-8 text-slate-400" />
//                   </div>
//                 )}
//                 <div className="p-4">
//                   <h4 className="font-bold text-slate-800 mb-1">{prop.name}</h4>
//                   <p className="text-sm text-slate-600 mb-2">{prop.address}, {prop.city}, {prop.state}</p>
//                   <div className="flex items-center gap-2 text-xs">
//                     <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-medium">
//                       {prop.units} {prop.units === 1 ? 'Unit' : 'Units'}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//         {properties.length > 6 && (
//           <div className="mt-4 text-center">
//             <p className="text-sm text-slate-500">
//               Showing 6 of {properties.length} properties. 
//               <a 
//                 href="#settings" 
//                 onClick={(e) => {
//                   e.preventDefault();
//                   window.location.hash = 'settings';
//                 }}
//                 className="text-indigo-600 hover:text-indigo-700 font-medium ml-1"
//               >
//                 View all
//               </a>
//             </p>
//           </div>
//         )}
//       </div>

//       {/* Action Required Section */}
//       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
//         <h3 className="text-lg font-semibold text-slate-800 mb-4">Action Required</h3>
//         <div className="space-y-3">
//           {tenants.filter(t => t.balance > 0).map(t => (
//             <div key={t.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100">
//               <div className="flex items-center gap-3">
//                 <AlertCircle className="w-5 h-5 text-rose-500" />
//                 <div>
//                   <p className="font-medium text-slate-800">Overdue Rent: {t.name}</p>
//                   <p className="text-sm text-slate-600">{t.propertyUnit} • Due: ${t.balance}</p>
//                 </div>
//               </div>
//               <button className="px-3 py-1 text-sm font-medium text-rose-700 bg-white border border-rose-200 rounded hover:bg-rose-50">
//                 Send Notice
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

// const StatCard = ({ title, value, icon: Icon, color, bg }: any) => (
//   <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
//     <div className={`p-3 rounded-lg ${bg}`}>
//       <Icon className={`w-6 h-6 ${color}`} />
//     </div>
//     <div>
//       <p className="text-sm font-medium text-slate-600">{title}</p>
//       <p className="text-2xl font-bold text-slate-900">{value}</p>
//     </div>
//   </div>
// );

// export default DashboardView;

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DollarSign, AlertCircle, CheckCircle2, Users, FileText, Building2, Home, Settings, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Zap, X, MapPin, Bed, Bath, Maximize, Wrench, Sparkles, Activity } from 'lucide-react';
import { Tenant, Payment, MaintenanceRequest, TenantStatus, Property } from '../types';
import Modal from './Modal';
import { api } from '../services/api';
import { formatDateMMDDYYYY } from '../utils/date';

interface DashboardProps {
  tenants: Tenant[];
  payments: Payment[];
  maintenance: MaintenanceRequest[];
  properties: Property[];
  onReviewApplications: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToTenants?: () => void;
  onNavigateToPayments?: () => void;
  onNavigateToMaintenance?: () => void;
}

const DASHBOARD_LISTING_AREAS = [
  'Avenue Q',
  'Sherman St',
  'Avenue H',
  '70th Street',
  'Wooding St',
  'Bella Jess Dr',
  'Magnolia Dr',
  'Westlock Dr',
];

const DashboardView: React.FC<DashboardProps> = ({ tenants, payments, maintenance, properties, onReviewApplications, onNavigateToSettings, onNavigateToTenants, onNavigateToPayments, onNavigateToMaintenance }) => {
  // Derived Metrics
  const totalRevenue = payments
    .filter(p => p.status === 'Paid')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const overdueAmount = tenants.reduce((acc, curr) => acc + curr.balance, 0);
  
  const occupancyRate = Math.round((tenants.filter(t => t.status === TenantStatus.ACTIVE).length / tenants.length) * 100) || 0;
  
  const openTickets = maintenance.filter(m => m.status !== 'Resolved').length;
  const newApplications = tenants.filter(t => t.status === TenantStatus.APPLICANT).length;

  // Send Reminders Modal State
  const [showSendRemindersModal, setShowSendRemindersModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedNoticeType, setSelectedNoticeType] = useState<string>('Notice of Late Rent');
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info' | 'warning',
  });
  
  // Property Modal State
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Property filters (dashboard Properties section)
  const [filterBedrooms, setFilterBedrooms] = useState<number | ''>('');
  const [filterBathrooms, setFilterBathrooms] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<'' | 'occupied' | 'vacant' | 'coming_soon'>('');
  const [filterArea, setFilterArea] = useState('');
  const [appliedFilterBedrooms, setAppliedFilterBedrooms] = useState<number | ''>('');
  const [appliedFilterBathrooms, setAppliedFilterBathrooms] = useState<number | ''>('');
  const [appliedFilterStatus, setAppliedFilterStatus] = useState<'' | 'occupied' | 'vacant' | 'coming_soon'>('');
  const [appliedFilterArea, setAppliedFilterArea] = useState('');
  const DASHBOARD_PROPERTIES_PAGE_SIZE = 6;
  const [dashboardPropertiesToShow, setDashboardPropertiesToShow] = useState(DASHBOARD_PROPERTIES_PAGE_SIZE);

  // Responsive state for chart labels and sizing
  const [screenSize, setScreenSize] = useState({
    isLarge: typeof window !== 'undefined' && window.innerWidth >= 1024,
    isMedium: typeof window !== 'undefined' && window.innerWidth >= 640 && window.innerWidth < 1024,
    isSmall: typeof window !== 'undefined' && window.innerWidth < 640,
  });
  
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        isLarge: window.innerWidth >= 1024,
        isMedium: window.innerWidth >= 640 && window.innerWidth < 1024,
        isSmall: window.innerWidth < 640,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const overdueTenants = tenants.filter(t => t.balance > 0);
  const tenantsMap = tenants.reduce((acc, t) => ({ ...acc, [t.id]: t }), {} as Record<string, Tenant>);

  const dashboardAreaOptions = useMemo(() => {
    const fromProps = properties.map(p => p.area).filter((a): a is string => Boolean(a?.trim()));
    return [...new Set([...DASHBOARD_LISTING_AREAS, ...fromProps])].sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const filteredDashboardProperties = useMemo(() => {
    let list = properties;
    if (appliedFilterBedrooms !== '') list = list.filter(p => Math.round(Number(p.bedrooms ?? 2)) === appliedFilterBedrooms);
    if (appliedFilterBathrooms !== '') list = list.filter(p => Math.round(Number(p.bathrooms ?? 2)) === appliedFilterBathrooms);
    if (appliedFilterStatus !== '') list = list.filter(p => (p.status ?? 'vacant') === appliedFilterStatus);
    if (appliedFilterArea) {
      const areaLower = appliedFilterArea.toLowerCase();
      list = list.filter(p => {
        if (p.area && p.area.toLowerCase() === areaLower) return true;
        const full = [p.address, p.name, p.city, p.state].filter(Boolean).join(' ').toLowerCase();
        return full.includes(areaLower);
      });
    }
    return list;
  }, [properties, appliedFilterBedrooms, appliedFilterBathrooms, appliedFilterStatus, appliedFilterArea]);

  useEffect(() => {
    setDashboardPropertiesToShow(DASHBOARD_PROPERTIES_PAGE_SIZE);
  }, [appliedFilterBedrooms, appliedFilterBathrooms, appliedFilterStatus, appliedFilterArea]);

  const applyDashboardFilters = () => {
    setAppliedFilterBedrooms(filterBedrooms);
    setAppliedFilterBathrooms(filterBathrooms);
    setAppliedFilterStatus(filterStatus);
    setAppliedFilterArea(filterArea.trim() || '');
  };

  const clearDashboardFilters = () => {
    setFilterBedrooms('');
    setFilterBathrooms('');
    setFilterStatus('');
    setFilterArea('');
    setAppliedFilterBedrooms('');
    setAppliedFilterBathrooms('');
    setAppliedFilterStatus('');
    setAppliedFilterArea('');
  };

  // Generate Recent Activity from real system data
  const getRecentActivity = () => {
    const activities: Array<{
      id: string;
      type: 'payment' | 'application' | 'maintenance' | 'tenant';
      icon: typeof DollarSign | typeof FileText | typeof AlertCircle | typeof Users;
      iconColor: string;
      iconBg: string;
      title: string;
      subtitle: string;
      time: string;
      date: Date;
    }> = [];

    // Add recent payments
    payments
      .filter(p => p.status === 'Paid')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .forEach(p => {
        const tenant = tenantsMap[p.tenantId];
        if (tenant) {
          const paymentDate = new Date(p.date);
          activities.push({
            id: `payment-${p.id}`,
            type: 'payment',
            icon: DollarSign,
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-100',
            title: `Payment received from ${tenant.name}`,
            subtitle: `${tenant.propertyUnit} • $${p.amount.toLocaleString()}`,
            time: formatActivityTime(paymentDate),
            date: paymentDate,
          });
        }
      });

    // Add recent applications
    tenants
      .filter(t => t.status === TenantStatus.APPLICANT)
      .slice(0, 3)
      .forEach(t => {
        const appDate = t.applicationData?.submissionDate 
          ? new Date(t.applicationData.submissionDate)
          : new Date(); // Fallback to current date if no submission date
        activities.push({
          id: `application-${t.id}`,
          type: 'application',
          icon: FileText,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100',
          title: 'New application submitted',
          subtitle: `${t.propertyUnit} • ${t.name}`,
          time: formatActivityTime(appDate),
          date: appDate,
        });
      });

    // Add recent maintenance updates
    maintenance
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .forEach(m => {
        const tenant = tenantsMap[m.tenantId];
        if (tenant) {
          const maintDate = new Date(m.createdAt);
          activities.push({
            id: `maintenance-${m.id}`,
            type: 'maintenance',
            icon: AlertCircle,
            iconColor: 'text-amber-600',
            iconBg: 'bg-amber-100',
            title: `Maintenance ticket ${m.status.toLowerCase()}`,
            subtitle: `${tenant.propertyUnit} • ${m.category}`,
            time: formatActivityTime(maintDate),
            date: maintDate,
          });
        }
      });

    // Add recent tenant moves (active tenants with recent lease start)
    tenants
      .filter(t => t.status === TenantStatus.ACTIVE && t.leaseStart)
      .map(t => ({
        tenant: t,
        date: new Date(t.leaseStart),
      }))
      .filter(item => {
        // Only include if lease started within last 30 days
        const daysSince = (new Date().getTime() - item.date.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 30;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 3)
      .forEach(item => {
        activities.push({
          id: `tenant-${item.tenant.id}`,
          type: 'tenant',
          icon: Users,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-100',
          title: 'New tenant moved in',
          subtitle: `${item.tenant.propertyUnit} • ${item.tenant.name}`,
          time: formatActivityTime(item.date),
          date: item.date,
        });
      });

    // Sort all activities by date (most recent first) and return top 4
    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 4);
  };

  // Format activity time display
  const formatActivityTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return formatDateMMDDYYYY(date);
    }
  };

  const recentActivity = getRecentActivity();

  // Calculate occupancy for a property
  const calculatePropertyOccupancy = (property: Property): number => {
    if (!property.units || property.units === 0) return 0;
    
    // Match tenants to this property by checking if propertyUnit contains property name or address
    const propertyNameLower = property.name.toLowerCase();
    const propertyAddressLower = property.address.toLowerCase();
    
    const activeTenantsForProperty = tenants.filter(t => {
      if (t.status !== TenantStatus.ACTIVE) return false;
      
      const unitLower = t.propertyUnit.toLowerCase();
      // Check if propertyUnit contains property name or address
      return unitLower.includes(propertyNameLower) || unitLower.includes(propertyAddressLower);
    });
    
    const occupancy = Math.round((activeTenantsForProperty.length / property.units) * 100);
    return occupancy;
  };

  // Handle Send Notice
  const handleSendNotice = async () => {
    if (!selectedTenantId || !selectedNoticeType) return;
    
    setIsSendingNotice(true);
    try {
      const response = await api.generateLegalNotice(selectedTenantId, selectedNoticeType);
      setModalState({
        isOpen: true,
        title: response.notice_email_sent === false ? 'Notice Created, Email Not Sent' : 'Notice Sent',
        message: response.notice_email_sent === false
          ? `Notice was created (Document ID: ${response.id}) but the email could not be delivered to the resident. Please check email configuration (e.g. SendGrid API key and from-address).`
          : `Notice sent successfully to tenant! Document ID: ${response.id}`,
        type: response.notice_email_sent === false ? 'info' : 'success',
      });
      setShowSendRemindersModal(false);
      setSelectedTenantId('');
      setSelectedNoticeType('Notice of Late Rent');
    } catch (error) {
      console.error('Error sending notice:', error);
      setModalState({
        isOpen: true,
        title: 'Send Notice Error',
        message: error instanceof Error ? error.message : 'Failed to send notice',
        type: 'error',
      });
    } finally {
      setIsSendingNotice(false);
    }
  };

  // Chart Data - Calculate monthly revenue from actual payment data
  const getMonthlyRevenue = () => {
    const now = new Date();
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Get last 5 months including current month
    for (let i = 4; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      const monthName = monthNames[monthIndex];
      
      // Calculate revenue for this month from paid payments
      const monthRevenue = payments
        .filter(p => {
          if (p.status !== 'Paid') return false;
          const paymentDate = new Date(p.date);
          return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === date.getFullYear();
        })
        .reduce((acc, p) => acc + p.amount, 0);
      
      months.push({
        name: monthName,
        amount: monthRevenue,
        trend: i === 0 ? 'up' : (monthRevenue > 0 ? 'up' : 'down')
      });
    }
    
    return months;
  };

  const revenueData = getMonthlyRevenue();

  const ticketData = [
    { name: 'Open', value: maintenance.filter(m => m.status === 'Open').length, color: '#ef4444' },
    { name: 'In Progress', value: maintenance.filter(m => m.status === 'In Progress').length, color: '#f59e0b' },
    { name: 'Resolved', value: maintenance.filter(m => m.status === 'Resolved').length, color: '#10b981' },
  ];

  // Quick Actions
  const quickActions = [
    { icon: FileText, label: 'Add Property', sub: 'Expand portfolio', gradient: 'linear-gradient(135deg,#4f46e5,#7c3aed)', href: '#settings' },
    { icon: Users, label: 'View Tenants', sub: 'Residents & leases', gradient: 'linear-gradient(135deg,#059669,#10b981)', href: '#tenants' },
    { icon: DollarSign, label: 'Record Payment', sub: 'Log rent received', gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', href: '#payments' },
    { icon: Wrench, label: 'Create Ticket', sub: 'Maintenance request', gradient: 'linear-gradient(135deg,#e11d48,#f43f5e)', href: '#maintenance' },
  ];

  const COLORS = ['#ef4444', '#f59e0b', '#10b981'];

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="dashboard-mesh space-y-7 sm:space-y-9 pb-8 animate-fade-in">
      {/* Hero */}
      <div className="dash-hero p-6 sm:p-8 lg:p-10">
        <div className="dash-hero-grid" aria-hidden />
        <div className="relative z-[1] flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-indigo-200 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              {todayLabel}
            </div>
            <div>
              <p className="text-indigo-200/90 text-sm font-medium mb-1">{greeting}</p>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white tracking-tight leading-[1.1]">
                Manager Dashboard
              </h1>
              <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                Revenue, occupancy, maintenance & portfolio — everything you need to run properties beautifully.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/25 text-emerald-200 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {properties.length} Properties
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-slate-200 text-xs font-semibold">
                <Users className="w-3.5 h-3.5" />
                {tenants.filter(t => t.status === TenantStatus.ACTIVE).length} Active Tenants
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 xl:flex-shrink-0">
            <button
              onClick={onReviewApplications}
              className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                newApplications > 0
                  ? 'bg-white text-indigo-900 shadow-xl shadow-black/20 hover:shadow-2xl hover:-translate-y-0.5'
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'
              }`}
            >
              {newApplications > 0 ? (
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {newApplications} New Application{newApplications !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  All Applications Reviewed
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 dash-stagger">
        <div className="dash-stat dash-stat--revenue">
          <div className="relative z-[1] flex items-start justify-between mb-5">
            <div className="dash-stat-icon"><DollarSign className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2 py-1 rounded-md">Revenue</span>
          </div>
          <p className="relative z-[1] text-3xl sm:text-4xl font-bold tracking-tight">${totalRevenue.toLocaleString()}</p>
          <p className="relative z-[1] text-emerald-100/80 text-sm mt-1 font-medium">Collected this period</p>
          <div className="relative z-[1] mt-4 flex items-center gap-1.5 text-xs text-emerald-100/70">
            <TrendingUp className="w-3.5 h-3.5" /> Trending positive
          </div>
        </div>

        <div className="dash-stat dash-stat--overdue">
          <div className="relative z-[1] flex items-start justify-between mb-5">
            <div className="dash-stat-icon"><AlertCircle className="w-5 h-5" /></div>
            {overdueAmount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2 py-1 rounded-md animate-pulse">Due</span>
            )}
          </div>
          <p className="relative z-[1] text-3xl sm:text-4xl font-bold tracking-tight">${overdueAmount.toLocaleString()}</p>
          <p className="relative z-[1] text-rose-100/80 text-sm mt-1 font-medium">Outstanding rent</p>
          <button
            onClick={() => setShowSendRemindersModal(true)}
            className="relative z-[1] mt-4 flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white transition-colors"
          >
            Send reminders <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="dash-stat dash-stat--occupancy">
          <div className="relative z-[1] flex items-start justify-between mb-5">
            <div className="dash-stat-icon"><Users className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2 py-1 rounded-md">{occupancyRate}%</span>
          </div>
          <p className="relative z-[1] text-3xl sm:text-4xl font-bold tracking-tight">{occupancyRate}%</p>
          <p className="relative z-[1] text-blue-100/80 text-sm mt-1 font-medium">Occupancy rate</p>
          <div className="relative z-[1] mt-4 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white/90 transition-all duration-700" style={{ width: `${occupancyRate}%` }} />
          </div>
        </div>

        <div className="dash-stat dash-stat--tickets">
          <div className="relative z-[1] flex items-start justify-between mb-5">
            <div className="dash-stat-icon"><Wrench className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2 py-1 rounded-md">
              {openTickets > 3 ? 'High' : 'Normal'}
            </span>
          </div>
          <p className="relative z-[1] text-3xl sm:text-4xl font-bold tracking-tight">{openTickets}</p>
          <p className="relative z-[1] text-amber-100/80 text-sm mt-1 font-medium">Open maintenance</p>
          <button
            onClick={() => onNavigateToMaintenance ? onNavigateToMaintenance() : (window.location.hash = 'maintenance')}
            className="relative z-[1] mt-4 flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white transition-colors"
          >
            View tickets <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="dash-section-label mb-4 px-0.5">Quick Actions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 dash-stagger">
          {quickActions.map((action, index) => (
            <a
              key={index}
              href={action.href}
              onClick={(e) => {
                e.preventDefault();
                if (action.label === 'Add Property' && onNavigateToSettings) onNavigateToSettings();
                else if (action.label === 'View Tenants' && onNavigateToTenants) onNavigateToTenants();
                else if (action.label === 'Record Payment' && onNavigateToPayments) onNavigateToPayments();
                else if (action.label === 'Create Ticket' && onNavigateToMaintenance) onNavigateToMaintenance();
                else window.location.hash = action.href.replace('#', '');
              }}
              className="dash-action group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="dash-action-icon flex-shrink-0" style={{ background: action.gradient }}>
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{action.label}</p>
                  <p className="text-[11px] text-slate-400 truncate hidden sm:block">{action.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0 hidden sm:block" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
        <div className="lg:col-span-3 dash-panel p-5 sm:p-6">
          <div className="dash-panel-header">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Revenue Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 5 months · paid rent</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
              <TrendingUp className="w-3.5 h-3.5" /> Live
            </div>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                  labelFormatter={(label) => `${label}`}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                />
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <Bar dataKey="amount" fill="url(#colorRevenue)" radius={[10, 10, 4, 4]} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 dash-panel p-5 sm:p-6">
          <div className="dash-panel-header">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Maintenance</h3>
              <p className="text-xs text-slate-500 mt-0.5">{maintenance.length} total tickets</p>
            </div>
          </div>
          <div className="h-52 sm:h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ticketData}
                  cx="50%" cy="50%"
                  innerRadius={screenSize.isSmall ? 48 : 58}
                  outerRadius={screenSize.isSmall ? 68 : 78}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {ticketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                  formatter={(value) => [value, 'Tickets']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900">{openTickets}</p>
                <p className="text-xs text-slate-500 font-medium">Open</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {ticketData.map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property Portfolio */}
      <div className="dash-panel p-5 sm:p-7">
        <div className="dash-panel-header !items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Property Portfolio</h3>
              <p className="text-xs text-slate-500">{properties.length} properties in your portfolio</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToSettings ? onNavigateToSettings() : (window.location.hash = 'settings')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
          >
            <Settings className="w-4 h-4" />
            Manage
          </button>
        </div>

        {properties.length > 0 && (
          <div className="dash-filter-bar mb-5">
            <span className="dash-section-label !text-slate-400">Filters</span>
            <select
              value={filterBedrooms === '' ? '' : String(filterBedrooms)}
              onChange={e => setFilterBedrooms(e.target.value === '' ? '' : Number(e.target.value))}
              className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
            >
              <option value="">Bedrooms: Any</option>
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} bedroom{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
            <select
              value={filterBathrooms === '' ? '' : String(filterBathrooms)}
              onChange={e => setFilterBathrooms(e.target.value === '' ? '' : Number(e.target.value))}
              className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
            >
              <option value="">Bathrooms: Any</option>
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>{n} bathroom{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as '' | 'occupied' | 'vacant' | 'coming_soon')}
              className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
            >
              <option value="">Status: Any</option>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="coming_soon">Coming Soon</option>
            </select>
            <select
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
            >
              <option value="">Area: Any</option>
              {dashboardAreaOptions.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyDashboardFilters}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              Apply
            </button>
            {(appliedFilterBedrooms !== '' || appliedFilterBathrooms !== '' || appliedFilterStatus !== '' || appliedFilterArea !== '') && (
              <button
                type="button"
                onClick={clearDashboardFilters}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        
        {properties.length === 0 ? (
          <div className="text-center py-8 sm:py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <Home className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
            </div>
            <h4 className="text-base sm:text-lg font-semibold text-slate-700 mb-1 sm:mb-2">No Properties Yet</h4>
            <p className="text-sm sm:text-base text-slate-500 mb-3 sm:mb-4">Add your first property to get started</p>
            <button className="px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              Add Property
            </button>
          </div>
        ) : filteredDashboardProperties.length === 0 ? (
          <div className="text-center py-8 sm:py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 px-4">
            <p className="text-slate-600 font-medium">No properties match the current filters.</p>
            <button
              type="button"
              onClick={clearDashboardFilters}
              className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {filteredDashboardProperties.slice(0, dashboardPropertiesToShow).map(prop => (
                <div key={prop.id} className="dash-property-card group cursor-pointer" onClick={() => { setSelectedProperty(prop); setShowPropertyModal(true); }}>
                  <div className="relative h-48 overflow-hidden">
                    {prop.image ? (
                      <img src={prop.image} alt={prop.name} className="dash-property-img w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-100 via-violet-50 to-slate-200 flex items-center justify-center">
                        <Home className="w-12 h-12 text-indigo-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[11px] font-bold text-slate-800 shadow-sm">
                      {prop.units} {prop.units === 1 ? 'Unit' : 'Units'}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h4 className="font-bold text-white text-lg leading-tight truncate">{prop.name}</h4>
                      <p className="text-slate-300 text-xs mt-0.5 truncate">{prop.address}, {prop.city}</p>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${
                        prop.status === 'occupied' ? 'bg-rose-100 text-rose-600' :
                        prop.status === 'coming_soon' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {prop.status === 'occupied' ? 'Occupied' : prop.status === 'coming_soon' ? 'Coming Soon' : 'Vacant'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{calculatePropertyOccupancy(prop)}% full</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                      View <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredDashboardProperties.length > dashboardPropertiesToShow && (
              <div className="mt-6 pt-6 border-t border-slate-200 text-center flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDashboardPropertiesToShow(prev => Math.min(prev + DASHBOARD_PROPERTIES_PAGE_SIZE, filteredDashboardProperties.length))}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  Load more ({filteredDashboardProperties.length - dashboardPropertiesToShow} remaining)
                  <ChevronRight className="w-4 h-4" />
                </button>
                {onNavigateToSettings && (
                  <button
                    type="button"
                    onClick={onNavigateToSettings}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                  >
                    View all in Settings
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="dash-panel p-5 sm:p-6">
          <div className="dash-panel-header">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Action Required</h3>
                <p className="text-xs text-slate-500">{tenants.filter(t => t.balance > 0).length} overdue items</p>
              </div>
            </div>
          </div>
          <div className="space-y-2.5">
            {tenants.filter(t => t.balance > 0).slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50/80 to-white hover:border-rose-200 hover:shadow-md transition-all">
                <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{t.name}</p>
                  <p className="text-xs text-slate-500 truncate">{t.propertyUnit} · <span className="text-rose-600 font-semibold">${t.balance} due</span></p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTenantId(t.id); setShowSendRemindersModal(true); }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex-shrink-0"
                >
                  Notice
                </button>
              </div>
            ))}
            {tenants.filter(t => t.balance > 0).length === 0 && (
              <div className="text-center py-10 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-slate-600 font-medium text-sm">All caught up — no pending actions</p>
              </div>
            )}
          </div>
        </div>

        <div className="dash-panel p-5 sm:p-6">
          <div className="dash-panel-header">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Activity className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                <p className="text-xs text-slate-500">Live feed across properties</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 text-slate-500">Today</span>
          </div>
          <div className="space-y-0.5">
            {recentActivity.length > 0 ? recentActivity.map((activity) => {
              const IconComponent = activity.icon;
              return (
                <div key={activity.id} className="dash-timeline-item flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${activity.iconBg}`}>
                    <IconComponent className={`w-4 h-4 ${activity.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{activity.title}</p>
                    <p className="text-xs text-slate-400 truncate">{activity.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{activity.time}</span>
                </div>
              );
            }) : (
              <div className="text-center py-10 text-slate-400 text-sm">No recent activity</div>
            )}
          </div>
        </div>
      </div>

      {/* Property Details Modal */}
      {showPropertyModal && selectedProperty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowPropertyModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800">{selectedProperty.name}</h3>
                  <p className="text-xs sm:text-sm text-slate-500">Property Details</p>
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${selectedProperty.status === 'occupied' ? 'bg-rose-100 text-rose-700' : selectedProperty.status === 'coming_soon' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedProperty.status === 'occupied' ? 'Occupied' : selectedProperty.status === 'coming_soon' ? 'Coming Soon' : 'Vacant'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPropertyModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-6">
                {/* Property Image */}
                {selectedProperty.image && (
                  <div className="relative h-48 sm:h-64 rounded-lg overflow-hidden border border-slate-200">
                    <img
                      src={selectedProperty.image}
                      alt={selectedProperty.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Property Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Location */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="p-2 bg-white rounded-lg">
                      <MapPin className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Location</p>
                      <p className="text-sm sm:text-base font-medium text-slate-800">
                        {selectedProperty.address}
                      </p>
                      <p className="text-sm text-slate-600">
                        {selectedProperty.city}, {selectedProperty.state}
                      </p>
                    </div>
                  </div>

                  {/* Units */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="p-2 bg-white rounded-lg">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Units</p>
                      <p className="text-sm sm:text-base font-bold text-slate-800">
                        {selectedProperty.units} {selectedProperty.units === 1 ? 'Unit' : 'Units'}
                      </p>
                    </div>
                  </div>

                  {/* Bedrooms */}
                  {selectedProperty.bedrooms && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="p-2 bg-white rounded-lg">
                        <Bed className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bedrooms</p>
                        <p className="text-sm sm:text-base font-bold text-slate-800">
                          {selectedProperty.bedrooms}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bathrooms */}
                  {selectedProperty.bathrooms && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="p-2 bg-white rounded-lg">
                        <Bath className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bathrooms</p>
                        <p className="text-sm sm:text-base font-bold text-slate-800">
                          {selectedProperty.bathrooms}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Square Footage */}
                  {selectedProperty.square_footage && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="p-2 bg-white rounded-lg">
                        <Maximize className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Square Footage</p>
                        <p className="text-sm sm:text-base font-bold text-slate-800">
                          {selectedProperty.square_footage.toLocaleString()} sq ft
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Price */}
                  {selectedProperty.price && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="p-2 bg-white rounded-lg">
                        <DollarSign className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Price</p>
                        <p className="text-sm sm:text-base font-bold text-slate-800">
                          ${selectedProperty.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Furnishing */}
                  {(selectedProperty.furnishingType || (selectedProperty.furnishingsBreakdown && selectedProperty.furnishingsBreakdown.length > 0)) && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 sm:col-span-2">
                      <div className="p-2 bg-white rounded-lg">
                        <Home className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Furnishing</p>
                        <p className="text-sm sm:text-base font-bold text-slate-800">
                          {selectedProperty.furnishingType || 'Furnished'}
                        </p>
                        {selectedProperty.furnishingsBreakdown && selectedProperty.furnishingsBreakdown.length > 0 && (
                          <p className="text-sm text-slate-600 mt-1">{selectedProperty.furnishingsBreakdown.join(' • ')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-4 sm:p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowPropertyModal(false);
                  if (onNavigateToSettings) {
                    onNavigateToSettings();
                  } else {
                    window.location.hash = 'settings';
                    window.dispatchEvent(new HashChangeEvent('hashchange'));
                  }
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Manage Property
              </button>
              <button
                onClick={() => setShowPropertyModal(false)}
                className="px-4 py-2.5 sm:py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Reminders Modal */}
      {showSendRemindersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              {selectedTenantId ? 'Send Legal Notice' : 'Send Reminder Notice'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {selectedTenantId 
                ? `Send a legal notice to ${tenantsMap[selectedTenantId]?.name} regarding their outstanding balance of $${tenantsMap[selectedTenantId]?.balance}.`
                : 'Select a tenant with outstanding rent to send a reminder notice.'}
            </p>
            <div className="space-y-4">
              {!selectedTenantId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Tenant</label>
                  <select 
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="">-- Select a tenant --</option>
                    {overdueTenants.map(tenant => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} - ${tenant.balance} ({tenant.propertyUnit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTenantId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notice Type</label>
                    <select 
                      value={selectedNoticeType}
                      onChange={(e) => setSelectedNoticeType(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    >
                      <option value="Notice of Late Rent">Late Fee Reminder (Friendly)</option>
                      <option value="3-Day Notice to Vacate">3-Day Notice to Vacate (Texas)</option>
                      <option value="30-Day Lease Termination">30-Day Lease Termination</option>
                      <option value="Lease Violation Notice">Lease Violation Notice</option>
                    </select>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                      <strong>Auto-populated details:</strong> The notice will automatically include {tenantsMap[selectedTenantId]?.name}'s property unit, balance amount of <strong className="text-rose-600">${tenantsMap[selectedTenantId]?.balance}</strong>, and other relevant information.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { 
                  setShowSendRemindersModal(false); 
                  setSelectedTenantId(''); 
                  setSelectedNoticeType('Notice of Late Rent'); 
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                disabled={isSendingNotice}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendNotice}
                disabled={isSendingNotice || !selectedTenantId}
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {isSendingNotice ? 'Sending...' : 'Send Notice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
};

export default DashboardView;