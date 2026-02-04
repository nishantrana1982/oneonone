'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Edit2, UserPlus, Users, Building2 } from 'lucide-react'
import { UserRole } from '@prisma/client'

interface User {
  id: string
  name: string | null
  email: string
  role: UserRole
  isActive: boolean
  departmentId: string | null
  reportsToId: string | null
  department: { name: string } | null
  reportsTo: { name: string | null } | null
}

interface Department {
  id: string
  name: string
}

interface UserManagementProps {
  users: User[]
  departments: Department[]
  reporters: User[]
}

export function UserManagement({ users, departments, reporters }: UserManagementProps) {
  const router = useRouter()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE' as UserRole,
    departmentId: '',
    reportsToId: '',
    isActive: true,
  })

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'EMPLOYEE',
      departmentId: '',
      reportsToId: '',
      isActive: true,
    })
  }

  const openAddModal = () => {
    resetForm()
    setEditingUser(null)
    setIsAddOpen(true)
  }

  const openEditModal = (user: User) => {
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || '',
      reportsToId: user.reportsToId || '',
      isActive: user.isActive,
    })
    setEditingUser(user)
    setIsAddOpen(true)
  }

  const closeModal = () => {
    setIsAddOpen(false)
    setEditingUser(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          departmentId: formData.departmentId || null,
          reportsToId: formData.reportsToId || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save user')
      }

      closeModal()
      router.refresh()
    } catch (error) {
      console.error('Error saving user:', error)
      alert(error instanceof Error ? error.message : 'Failed to save user')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark-gray dark:text-white mb-2">
            User Management
          </h1>
          <p className="text-medium-gray">Manage employees, roles, and reporting structure</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-3 bg-orange text-white rounded-xl font-medium hover:bg-orange/90 transition-all shadow-lg shadow-orange/25"
        >
          <UserPlus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">{users.length}</p>
              <p className="text-sm text-medium-gray">Total Users</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">
                {users.filter(u => u.isActive).length}
              </p>
              <p className="text-sm text-medium-gray">Active</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-off-white dark:bg-dark-gray flex items-center justify-center">
              <Building2 className="w-5 h-5 text-dark-gray dark:text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-gray dark:text-white">{departments.length}</p>
              <p className="text-sm text-medium-gray">Departments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-off-white dark:border-medium-gray/20">
          <h2 className="font-semibold text-dark-gray dark:text-white">All Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-off-white dark:border-medium-gray/20 bg-off-white/50 dark:bg-charcoal/50">
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Name</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Email</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Role</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Department</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Reports To</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Status</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-medium-gray">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-off-white/50 dark:border-medium-gray/10 hover:bg-off-white/50 dark:hover:bg-charcoal/50 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange/20 to-orange/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-orange">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <span className="font-medium text-dark-gray dark:text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-medium-gray">{user.email}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      user.role === 'SUPER_ADMIN'
                        ? 'bg-orange/10 text-orange'
                        : user.role === 'REPORTER'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-medium-gray">
                    {user.department?.name || '-'}
                  </td>
                  <td className="py-4 px-6 text-sm text-medium-gray">
                    {user.reportsTo?.name || '-'}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      user.isActive
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 hover:bg-off-white dark:hover:bg-charcoal rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-medium-gray" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-charcoal border border-off-white dark:border-medium-gray/20 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-off-white dark:border-medium-gray/20">
              <h2 className="text-lg font-semibold text-dark-gray dark:text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-off-white dark:hover:bg-charcoal rounded-lg">
                <X className="w-5 h-5 text-medium-gray" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="REPORTER">Reporter / Team Lead</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                  >
                    <option value="">No Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-gray dark:text-white mb-1">
                  Reports To
                </label>
                <select
                  value={formData.reportsToId}
                  onChange={(e) => setFormData({ ...formData, reportsToId: e.target.value })}
                  className="w-full rounded-xl border border-off-white dark:border-medium-gray/20 bg-off-white dark:bg-charcoal px-4 py-3 text-dark-gray dark:text-white focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
                >
                  <option value="">No Manager</option>
                  {reporters.filter(r => r.id !== editingUser?.id).map((reporter) => (
                    <option key={reporter.id} value={reporter.id}>
                      {reporter.name} ({reporter.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {editingUser && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-off-white text-orange focus:ring-orange"
                  />
                  <label htmlFor="isActive" className="text-sm text-dark-gray dark:text-white">
                    Active user
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm font-medium text-medium-gray hover:text-dark-gray dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 text-sm font-medium bg-orange text-white rounded-xl hover:bg-orange/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Saving...' : editingUser ? 'Save Changes' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
