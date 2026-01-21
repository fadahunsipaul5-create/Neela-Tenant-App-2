
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

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DollarSign, AlertCircle, CheckCircle2, Users, FileText, Building2, Home, Settings, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Zap, X, MapPin, Bed, Bath, Maximize } from 'lucide-react';
import { Tenant, Payment, MaintenanceRequest, TenantStatus, Property } from '../types';
import Modal from './Modal';
import { api } from '../services/api';

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
        title: 'Notice Sent',
        message: `Notice sent successfully to tenant! Document ID: ${response.id}`,
        type: 'success',
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

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10 animate-fade-in px-2 sm:px-0">
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 pb-4 sm:pb-6 border-b-2 border-slate-100">
        <div className="w-full lg:w-auto">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent tracking-tight mb-2 sm:mb-3">
            Dashboard Overview
          </h1>
          <p className="text-slate-600 text-sm sm:text-base lg:text-lg font-medium leading-relaxed">Welcome back! Here's what's happening with your properties today.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
          <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm text-slate-600 bg-gradient-to-r from-slate-50 to-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full border-2 border-slate-200 shadow-sm font-semibold">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
            <span className="hidden md:inline">Last updated: Just now</span>
            <span className="md:hidden">Just now</span>
          </div>
          <button 
            onClick={onReviewApplications}
            className={`relative px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 ${
              newApplications > 0 
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl group' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            aria-label={newApplications > 0 ? `Review ${newApplications} new applications` : 'No new applications'}
          >
            {newApplications > 0 ? (
              <span className="flex items-center gap-2 sm:gap-3">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Review Applications ({newApplications})</span>
                <span className="sm:hidden">Review ({newApplications})</span>
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  HURRY!
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">No New Applications</span>
                <span className="sm:hidden">No New</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
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
            className="group bg-white/95 backdrop-blur-sm p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border-2 border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 transform hover:-translate-y-1 sm:hover:-translate-y-1.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
            aria-label={`Quick action: ${action.label}`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className={`${action.color} p-2.5 sm:p-3 lg:p-3.5 rounded-lg sm:rounded-xl text-white group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <action.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm sm:text-base truncate">{action.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 sm:mt-1 font-medium hidden sm:block">Quick action</p>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all hidden sm:block flex-shrink-0" />
            </div>
          </a>
        ))}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <div className="bg-gradient-to-br from-white via-emerald-50/30 to-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl border-2 border-slate-200 shadow-lg shadow-emerald-500/5 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-200 transition-all duration-300 group">
          <div className="flex items-start justify-between mb-4 sm:mb-5">
            <div className="p-3 sm:p-3.5 lg:p-4 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl sm:rounded-2xl shadow-md">
              <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-emerald-700" />
            </div>
            <span className="text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
              +12.5%
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2 tracking-tight">${totalRevenue.toLocaleString()}</h3>
          <p className="text-slate-600 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">Monthly Revenue</p>
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t-2 border-slate-100 flex items-center text-xs text-slate-600 font-medium">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-emerald-600 flex-shrink-0" />
            <span className="truncate">On track for monthly target</span>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-white via-rose-50/30 to-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl border-2 border-slate-200 shadow-lg shadow-rose-500/5 hover:shadow-xl hover:shadow-rose-500/10 hover:border-rose-300 transition-all duration-300 group">
          {overdueAmount > 0 && (
            <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg animate-pulse flex items-center gap-1 z-10">
              <Clock className="w-3 h-3" />
              HURRY!
            </div>
          )}
          <div className="flex items-start justify-between mb-4 sm:mb-5">
            <div className="p-3 sm:p-3.5 lg:p-4 bg-gradient-to-br from-rose-100 to-rose-200 rounded-xl sm:rounded-2xl shadow-md group-hover:scale-110 transition-transform duration-300">
              <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-rose-700" />
            </div>
            <span className="text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-100 text-rose-700 rounded-full border border-rose-200 group-hover:bg-rose-200 group-hover:border-rose-300 transition-colors">
              <span className="hidden sm:inline">Needs Attention</span>
              <span className="sm:hidden">Attention</span>
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2 tracking-tight">${overdueAmount.toLocaleString()}</h3>
          <p className="text-slate-600 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">Outstanding Rent</p>
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t-2 border-slate-100">
            <button 
              onClick={() => setShowSendRemindersModal(true)}
              className="relative text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center group-hover:gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/30 rounded px-1"
            >
              <span className="hidden sm:inline">Send Reminders</span>
              <span className="sm:hidden">Reminders</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1 group-hover:animate-pulse" />
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-blue-50/30 to-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl border-2 border-slate-200 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-300 group">
          <div className="flex items-start justify-between mb-4 sm:mb-5">
            <div className="p-3 sm:p-3.5 lg:p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl sm:rounded-2xl shadow-md">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-700" />
            </div>
            <span className="text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
              Optimal
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2 tracking-tight">{occupancyRate}%</h3>
          <p className="text-slate-600 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">Occupancy Rate</p>
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t-2 border-slate-100 flex items-center gap-2 sm:gap-3">
            <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${occupancyRate}%` }}
              ></div>
            </div>
            <span className="text-xs text-slate-600 font-bold whitespace-nowrap">{tenants.filter(t => t.status === TenantStatus.ACTIVE).length} active</span>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-white via-amber-50/30 to-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl border-2 border-slate-200 shadow-lg shadow-amber-500/5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-300 transition-all duration-300 group">
          {openTickets > 0 && (
            <div className="absolute -top-3 -right-3 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg animate-pulse flex items-center gap-1 z-10">
              <Zap className="w-3 h-3" />
              HURRY!
            </div>
          )}
          <div className="flex items-start justify-between mb-4 sm:mb-5">
            <div className="p-3 sm:p-3.5 lg:p-4 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl sm:rounded-2xl shadow-md group-hover:scale-110 transition-transform duration-300">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-amber-700" />
            </div>
            <span className={`text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border transition-colors ${
              openTickets > 3 ? 'bg-rose-100 text-rose-700 border-rose-200 group-hover:bg-rose-200 group-hover:border-rose-300' : 'bg-amber-100 text-amber-700 border-amber-200 group-hover:bg-amber-200 group-hover:border-amber-300'
            }`}>
              {openTickets > 3 ? 'High' : 'Normal'}
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2 tracking-tight">{openTickets}</h3>
          <p className="text-slate-600 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">Open Tickets</p>
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t-2 border-slate-100">
            <button className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center group-hover:gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/30 rounded px-1">
              <span className="hidden sm:inline">View All Tickets</span>
              <span className="sm:hidden">View All</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1 group-hover:animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Revenue Overview</h3>
              <p className="text-xs sm:text-sm text-slate-600">Monthly revenue performance</p>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                <span className="text-slate-600">Revenue</span>
              </div>
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
        <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Maintenance Status</h3>
              <p className="text-xs sm:text-sm text-slate-600">Ticket distribution</p>
            </div>
            <div className="text-xs sm:text-sm text-slate-500">
              Total: {maintenance.length}
            </div>
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
      <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              Property Portfolio
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">Manage your properties and units</p>
          </div>
          <button
            onClick={() => {
              if (onNavigateToSettings) {
                onNavigateToSettings();
              } else {
                window.location.hash = 'settings';
                // Fallback: trigger hashchange event
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            }}
            className="group flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm sm:text-base"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Manage Properties</span>
            <span className="sm:hidden">Manage</span>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform hidden sm:block" />
          </button>
        </div>
        
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
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {properties.slice(0, 6).map(prop => (
                <div 
                  key={prop.id} 
                  className="group bg-gradient-to-b from-white to-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="relative h-48 overflow-hidden">
                    {prop.image ? (
                      <img 
                        src={prop.image} 
                        alt={prop.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <Home className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-slate-800">
                      {prop.units} {prop.units === 1 ? 'Unit' : 'Units'}
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-slate-800 text-lg mb-2 group-hover:text-indigo-600 transition-colors">
                      {prop.name}
                    </h4>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {prop.address}, {prop.city}, {prop.state}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="text-sm text-slate-500">
                        Occupancy: <span className="font-semibold text-slate-700">{calculatePropertyOccupancy(prop)}%</span>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedProperty(prop);
                          setShowPropertyModal(true);
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                      >
                        View Details
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {properties.length > 6 && (
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <a 
                  href="#settings"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = 'settings';
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  View All Properties ({properties.length})
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Required & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Action Required */}
        <div className="relative bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-rose-200 transition-all duration-200 group">
          {tenants.filter(t => t.balance > 0).length > 0 && (
            <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg animate-pulse flex items-center gap-1.5 z-10">
              <Clock className="w-3 h-3" />
              HURRY!
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                Action Required
                {tenants.filter(t => t.balance > 0).length > 0 && (
                  <Clock className="w-4 h-4 text-rose-500 group-hover:animate-pulse" />
                )}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">Items needing your attention</p>
            </div>
            <span className="px-2.5 sm:px-3 py-1 bg-rose-100 text-rose-700 text-xs sm:text-sm font-medium rounded-full group-hover:bg-rose-200 group-hover:scale-105 transition-all duration-200">
              {tenants.filter(t => t.balance > 0).length} items
            </span>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            {tenants.filter(t => t.balance > 0).slice(0, 3).map(t => (
              <div key={t.id} className="relative p-3 sm:p-4 bg-gradient-to-r from-rose-50/50 to-white rounded-xl border border-rose-100 hover:border-rose-300 hover:shadow-lg transition-all duration-200 group">
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md animate-pulse flex items-center gap-1 z-10">
                  <Clock className="w-2.5 h-2.5" />
                  HURRY
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="p-1.5 sm:p-2 bg-rose-100 rounded-lg flex-shrink-0 group-hover:bg-rose-200 group-hover:scale-110 transition-all duration-200">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base truncate">{t.name}</p>
                      <p className="text-xs sm:text-sm text-slate-600 truncate">{t.propertyUnit} • Due: ${t.balance}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedTenantId(t.id);
                      setShowSendRemindersModal(true);
                    }}
                    className="w-full sm:w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 px-3 py-1.5 bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 hover:border-rose-300 hover:shadow-md text-xs sm:text-sm font-medium transition-all"
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
        <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Recent Activity</h3>
              <p className="text-xs sm:text-sm text-slate-600">Latest updates across properties</p>
            </div>
            <span className="px-2.5 sm:px-3 py-1 bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium rounded-full">
              Today
            </span>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm sm:text-base truncate">Payment received from John Doe</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Unit 201 • $1,200</p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">10:30 AM</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm sm:text-base truncate">New application submitted</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Unit 305 • Jane Smith</p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">9:15 AM</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm sm:text-base truncate">Maintenance ticket updated</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Unit 102 • Plumbing issue</p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">Yesterday</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm sm:text-base truncate">New tenant moved in</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Unit 405 • Michael Brown</p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">Yesterday</span>
            </div>
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