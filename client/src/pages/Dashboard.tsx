import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "../hooks/use-user";
import { Button } from "@/components/ui/button";
import ObjectList from "../components/ObjectList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "../components/UserManagement";

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useUser();

  useEffect(() => {
    if (!user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const isAdmin = user?.roles?.some(r => r.name === "admin");

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">CRM Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.username} ({user.roles?.map(r => r.name).join(", ")})
            </span>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="objects">
          <TabsList>
            <TabsTrigger value="objects">Objects</TabsTrigger>
            <TabsTrigger value="types">Object Types</TabsTrigger>
            {isAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
          </TabsList>
          <TabsContent value="objects">
            <ObjectList />
          </TabsContent>
          <TabsContent value="types">
            <div className="text-center py-8 text-gray-500">
              Object type management coming soon
            </div>
          </TabsContent>
          {isAdmin && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
