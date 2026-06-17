
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
import { DollarSign, AlertCircle, CheckCircle2, Users, FileText, Building2, Home, Settings, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Zap, X, MapPin, Bed, Bath, Maximize, Wrench } from 'lucide-react';
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
    { icon: FileText, label: 'Add Property', color: 'bg-indigo-500', href: '#settings' },
    { icon: Users, label: 'View Tenants', color: 'bg-emerald-500', href: '#tenants' },
    { icon: DollarSign, label: 'Record Payment', color: 'bg-amber-500', href: '#payments' },
    { icon: AlertCircle, label: 'Create Ticket', color: 'bg-rose-500', href: '#maintenance' },
  ];

  const COLORS = ['#ef4444', '#f59e0b', '#10b981'];

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard-mesh space-y-6 sm:space-y-8 animate-fade-in px-1 sm:px-0 pb-4">
      {/* Hero */}
      <div className="glass-card-strong rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-200/40 via-violet-100/20 to-transparent rounded-full blur-3xl pointer-events-none" aria-hidden />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 sm:gap-6 relative">
          <div className="space-y-2 sm:space-y-3">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-indigo-500/80">{todayLabel}</p>
            <h1 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold text-slate-900 tracking-tight leading-tight">
              Property Manager
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600">
                Dashboard
              </span>
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl leading-relaxed">
              Your portfolio at a glance — revenue, occupancy, maintenance, and properties in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-emerald-700 bg-emerald-50/80 px-4 py-2.5 rounded-full border border-emerald-100 font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live sync
            </div>
            <button 
              onClick={onReviewApplications}
              className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                newApplications > 0 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              aria-label={newApplications > 0 ? `Review ${newApplications} new applications` : 'No new applications'}
            >
              {newApplications > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  Review Applications ({newApplications})
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  No New Applications
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 sm:mb-4 px-1">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action, index) => (
          <a
            key={index}
            href={action.href}
            onClick={(e) => {
              e.preventDefault();
              if (action.label === 'Add Property' && onNavigateToSettings) {
                onNavigateToSettings();
              } else if (action.label === 'View Tenants' && onNavigateToTenants) {
                onNavigateToTenants();
              } else if (action.label === 'Record Payment' && onNavigateToPayments) {
                onNavigateToPayments();
              } else if (action.label === 'Create Ticket' && onNavigateToMaintenance) {
                onNavigateToMaintenance();
              } else {
                window.location.hash = action.href.replace('#', '');
              }
            }}
            className="group glass-card p-4 sm:p-5 rounded-2xl hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            aria-label={`Quick action: ${action.label}`}
          >
            <div className="flex flex-col gap-3">
              <div className={`${action.color} w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm sm:text-base">{action.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:flex items-center gap-1">
                  Go <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </div>
          </a>
        ))}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="stat-card stat-accent-emerald glass-card-strong rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="stat-icon-ring p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full">+12.5%</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">${totalRevenue.toLocaleString()}</h3>
          <p className="text-slate-500 text-sm font-medium mt-1">Monthly Revenue</p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-500">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            On track for target
          </div>
        </div>

        <div className="stat-card stat-accent-rose glass-card-strong rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="stat-icon-ring p-3 rounded-xl">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            {overdueAmount > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full">Attention</span>
            )}
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">${overdueAmount.toLocaleString()}</h3>
          <p className="text-slate-500 text-sm font-medium mt-1">Outstanding Rent</p>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button 
              onClick={() => setShowSendRemindersModal(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
            >
              Send Reminders <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="stat-card stat-accent-blue glass-card-strong rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="stat-icon-ring p-3 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">Optimal</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{occupancyRate}%</h3>
          <p className="text-slate-500 text-sm font-medium mt-1">Occupancy Rate</p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">{tenants.filter(t => t.status === TenantStatus.ACTIVE).length} active</span>
          </div>
        </div>

        <div className="stat-card stat-accent-amber glass-card-strong rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="stat-icon-ring p-3 rounded-xl">
              <Wrench className="w-6 h-6 text-amber-600" />
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              openTickets > 3 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {openTickets > 3 ? 'High' : 'Normal'}
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{openTickets}</h3>
          <p className="text-slate-500 text-sm font-medium mt-1">Open Tickets</p>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button 
              onClick={() => {
                if (onNavigateToMaintenance) {
                  onNavigateToMaintenance();
                } else {
                  window.location.hash = 'maintenance';
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }
              }}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
            >
              View All Tickets <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 glass-card-strong p-5 sm:p-6 rounded-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Revenue Overview</h3>
              <p className="text-xs sm:text-sm text-slate-500">Last 5 months performance</p>
            </div>
            <div className="flex items-center gap-2 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-medium">
              <div className="w-2 h-2 bg-indigo-500 rounded-full" />
              Revenue
            </div>
          </div>
          <div className="h-64 sm:h-72 -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value) => [`$${value}`, 'Revenue']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Bar 
                  dataKey="amount" 
                  fill="url(#colorRevenue)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={2000}
                />
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Maintenance Pie Chart */}
        <div className="glass-card-strong p-5 sm:p-6 rounded-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Maintenance</h3>
              <p className="text-xs sm:text-sm text-slate-500">Ticket distribution</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium">
              {maintenance.length} total
            </span>
          </div>
          <div className="h-64 sm:h-72 relative -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ticketData}
                  cx="50%"
                  cy="50%"
                  innerRadius={screenSize.isSmall ? 50 : screenSize.isMedium ? 60 : 70}
                  outerRadius={screenSize.isSmall ? 70 : screenSize.isMedium ? 80 : 90}
                  paddingAngle={2}
                  dataKey="value"
                  label={screenSize.isLarge ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
                  labelLine={screenSize.isLarge}
                >
                  {ticketData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [value, 'Tickets']}
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-xl sm:text-2xl font-bold text-slate-800">{openTickets}</div>
              <div className="text-xs sm:text-sm text-slate-500">Open</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 mt-3 sm:mt-4">
            {ticketData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                <div 
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-xs sm:text-sm text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property Portfolio Section */}
      <div className="glass-card-strong p-5 sm:p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-100">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </span>
              Property Portfolio
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage your properties and units</p>
          </div>
          <button
            onClick={() => {
              if (onNavigateToSettings) {
                onNavigateToSettings();
              } else {
                window.location.hash = 'settings';
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            }}
            className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            Manage Properties
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {properties.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 p-3 sm:p-4 glass-card rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredDashboardProperties.slice(0, dashboardPropertiesToShow).map(prop => (
                <div 
                  key={prop.id} 
                  className="group glass-card rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative h-44 overflow-hidden">
                    {prop.image ? (
                      <img 
                        src={prop.image} 
                        alt={prop.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-200 via-indigo-100 to-violet-100 flex items-center justify-center">
                        <Home className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h4 className="font-bold text-white text-base drop-shadow-sm truncate">{prop.name}</h4>
                    </div>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-slate-800">
                      {prop.units} {prop.units === 1 ? 'Unit' : 'Units'}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-slate-500 mb-3 line-clamp-1">
                      {prop.address}, {prop.city}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${prop.status === 'occupied' ? 'bg-rose-50 text-rose-600' : prop.status === 'coming_soon' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {prop.status === 'occupied' ? 'Occupied' : prop.status === 'coming_soon' ? 'Coming Soon' : 'Vacant'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {calculatePropertyOccupancy(prop)}% full
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedProperty(prop);
                          setShowPropertyModal(true);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                      >
                        Details <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
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

      {/* Action Required & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Action Required */}
        <div className="glass-card-strong p-5 sm:p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                Action Required
                {tenants.filter(t => t.balance > 0).length > 0 && (
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">Items needing your attention</p>
            </div>
            <span className="px-3 py-1 bg-rose-50 text-rose-600 text-xs font-semibold rounded-full">
              {tenants.filter(t => t.balance > 0).length} items
            </span>
          </div>
          
          <div className="space-y-3">
            {tenants.filter(t => t.balance > 0).slice(0, 3).map(t => (
              <div key={t.id} className="p-4 glass-card rounded-xl hover:shadow-md transition-all duration-200 group">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-rose-50 rounded-lg flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 text-sm truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 truncate">{t.propertyUnit} · Due ${t.balance}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedTenantId(t.id);
                      setShowSendRemindersModal(true);
                    }}
                    className="w-full sm:w-auto px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-xs font-semibold transition-colors"
                  >
                    Send Notice
                  </button>
                </div>
              </div>
            ))}
            
            {tenants.filter(t => t.balance > 0).length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-600">All caught up! No pending actions.</p>
              </div>
            )}
          </div>
          
          {tenants.filter(t => t.balance > 0).length > 3 && (
            <div className="mt-6 pt-4 border-t border-slate-200">
              <button className="w-full py-2.5 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-50 transition-colors">
                View All Actions ({tenants.filter(t => t.balance > 0).length})
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card-strong p-5 sm:p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Recent Activity</h3>
              <p className="text-xs sm:text-sm text-slate-500">Latest updates across properties</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
              Today
            </span>
          </div>
          
          <div className="space-y-1">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, idx) => {
                const IconComponent = activity.icon;
                return (
                  <div key={activity.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50/80 transition-colors relative">
                    {idx < recentActivity.length - 1 && (
                      <div className="absolute left-[1.65rem] top-10 bottom-0 w-px bg-slate-200" aria-hidden />
                    )}
                    <div className={`p-2 ${activity.iconBg} rounded-xl flex-shrink-0 z-[1]`}>
                      <IconComponent className={`w-4 h-4 ${activity.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{activity.title}</p>
                      <p className="text-xs text-slate-400 truncate">{activity.subtitle}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0 font-medium">{activity.time}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">No recent activity to display</p>
              </div>
            )}
          </div>
          
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-200">
            <button className="w-full py-2 sm:py-2.5 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm sm:text-base">
              View Full Activity Log
            </button>
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