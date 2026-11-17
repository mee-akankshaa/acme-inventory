import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { useQuery, useMutation } from '@tanstack/react-query'
import { vendorsApi } from '../services/vendors'
import axios from 'axios'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  city: z.string().optional(),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function VendorEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [generalError, setGeneralError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => vendorsApi.get(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (vendor) {
      reset({
        name: vendor.name,
        contactName: vendor.contactName ?? '',
        phone: vendor.phone ?? '',
        email: vendor.email ?? '',
        city: vendor.city ?? '',
        address: vendor.address ?? '',
      })
    }
  }, [vendor, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => vendorsApi.update(id!, data),
    onSuccess: () => {
      navigate('/vendors')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 400) {
          setGeneralError(err.response.data?.error ?? 'Invalid data. Please check the form.')
          return
        }
      }
      setGeneralError('Something went wrong. Please try again.')
    },
  })

  function onSubmit(data: FormValues) {
    setGeneralError('')
    mutation.mutate(data)
  }

  if (vendorLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading vendor...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <BackButton to="/vendors" />
      <Breadcrumbs crumbs={[{ label: 'Vendors', to: '/vendors' }, { label: 'Edit Vendor' }]} />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/vendors" className="text-sm text-gray-500 hover:text-gray-700">
            ← Vendors
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Edit Vendor</h1>
        </div>
      </div>

        {generalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {generalError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Vendor / company name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Contact Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
            <input
              {...register('contactName')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Primary contact person"
            />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                {...register('phone')}
                type="tel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="+1 555 010 0100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="vendor@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              {...register('city')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Springfield"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
            <textarea
              {...register('address')}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Street, area..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
    </div>
  )
}
