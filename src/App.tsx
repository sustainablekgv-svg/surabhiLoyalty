import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AdminDashboard from "./pages/admin/Dashboard";
import StaffDashboard from "./pages/staff/Dashboard";
import CustomerDashboard from "./pages/customer/Dashboard";
import NotFound from "./pages/NotFound";
import { CustomerDetails } from "./components/staff/CustomerDetails";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customers/:customerId" element={<CustomerDetails />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
