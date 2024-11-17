import useSWR from "swr";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "../hooks/use-user";

interface User {
  id: number;
  username: string;
  companyId: number;
  roles: Array<{ id: number; name: string; permissions: any }>;
}

interface Role {
  id: number;
  name: string;
  permissions: any;
}

export default function UserManagement() {
  const { user: currentUser } = useUser();
  const { data: users, mutate: mutateUsers } = useSWR<User[]>("/api/users");
  const { data: roles } = useSWR<Role[]>("/api/roles");
  const { toast } = useToast();
  const [loading, setLoading] = useState<number | null>(null);

  // Filter users to only show those from the same company
  const companyUsers = users?.filter(user => user.companyId === currentUser?.companyId);

  const handleRoleChange = async (userId: number, roleId: string) => {
    setLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: parseInt(roleId) }),
      });

      if (!response.ok) throw new Error("Failed to update role");

      await mutateUsers();
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">User Management</h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Current Roles</TableHead>
            <TableHead>Assign Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companyUsers?.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell>
              <TableCell>
                {user.roles?.map((role) => role.name).join(", ")}
              </TableCell>
              <TableCell>
                <Select
                  disabled={loading === user.id}
                  onValueChange={(value) => handleRoleChange(user.id, value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Assign role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
