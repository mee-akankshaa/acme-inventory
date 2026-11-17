import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { useQuery, useMutation } from '@tanstack/react-query'
import { productsApi } from '../services/products'
import { vendorsApi } from '../services/vendors'
import axios from 'axios'
import BackButton from '../components/BackButton'
import Breadcrumbs from '../components/Breadcrumbs'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  unit: z.enum(['pcs', 'kg', 'ltr', 'box'] as const, { required_error: 'Unit is required' }),
  price: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) > 0), {
      message: 'Price must be a positive number',
    }),
  costPrice: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) > 0), {
      message: 'Cost price must be a positive number',
    }),
  categoryId: z.string().optional(),
  vendorId: z.string().uuid().optional().or(z.literal('')),
  minStockLevel: z.coerce.number().int().min(0, 'Must be 0 or more'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [generalError, setGeneralError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { minStockLevel: 0 },
  })

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.categories(),
  })

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => vendorsApi.list({ limit: 100 }),
  })

  // Prefill form once product data arrives
  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku,
        unit: product.unit as FormValues['unit'],
        price: product.price ?? '',
        costPrice: product.costPrice ?? '',
        categoryId: product.categoryId ?? '',
        vendorId: (product as unknown as { vendorId?: string }).vendorId ?? '',
        minStockLevel: product.minStockLevel,
        description: product.description ?? '',
      })
    }
  }, [product, reset])

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productsApi.update(id!, data),
    onSuccess: () => {
      alert('Product updated successfully!')
      navigate('/products')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setError('sku', { message: 'SKU already exists' })
          return
        }
        if (err.response?.status === 400) {
          setGeneralError(err.response.data?.message ?? 'Invalid data. Please check the form.')
          return
        }
      }
      setGeneralError('Something went wrong. Please try again.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => productsApi.delete(id!),
    onSuccess: () => {
      navigate('/products')
    },
    onError: () => {
      setGeneralError('Failed to delete product. Please try again.')
    },
  })

  function onSubmit(data: FormValues) {
    setGeneralError('')
    updateMutation.mutate({ ...data, sku: data.sku.toUpperCase() })
  }

  function handleDelete() {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  if (productLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading product...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <BackButton to="/products" />
      <Breadcrumbs crumbs={[{ label: 'Products', to: '/products' }, { label: 'Edit Product' }]} />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/products" className="text-sm text-gray-500 hover:text-gray-700">
            ← Products
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Edit Product</h1>
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
              placeholder="Product name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              {...register('sku')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. PROD-001"
            />
            {errors.sku && (
              <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>
            )}
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              {...register('unit')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select unit</option>
              <option value="pcs">pcs</option>
              <option value="kg">kg</option>
              <option value="ltr">ltr</option>
              <option value="box">box</option>
            </select>
            {errors.unit && (
              <p className="mt-1 text-xs text-red-600">{errors.unit.message}</p>
            )}
          </div>

          {/* Price & Cost Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <input
                {...register('price')}
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
              />
              {errors.price && (
                <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price ($)</label>
              <input
                {...register('costPrice')}
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
              />
              {errors.costPrice && (
                <p className="mt-1 text-xs text-red-600">{errors.costPrice.message}</p>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              {...register('categoryId')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No category</option>
              {(categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <select
              {...register('vendorId')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No vendor</option>
              {(vendorsData?.vendors ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Min Stock Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
            <input
              {...register('minStockLevel')}
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0"
            />
            {errors.minStockLevel && (
              <p className="mt-1 text-xs text-red-600">{errors.minStockLevel.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Optional description..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-60 transition-colors"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Product'}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
    </div>
  )
}
