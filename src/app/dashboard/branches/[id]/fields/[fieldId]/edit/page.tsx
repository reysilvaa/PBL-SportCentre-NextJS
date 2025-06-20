'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fieldApi } from '@/api/field.api';
import { branchApi } from '@/api/branch.api';
import { Field, FieldType, Branch } from '@/types';
import useGlobalLoading from '@/hooks/useGlobalLoading.hook';
import Image from 'next/image';
import React from 'react';
import useToastHandler from '@/hooks/useToastHandler';  

const updateFieldSchema = z.object({
    name: z.string().min(3, 'Nama lapangan minimal 3 karakter'),
    typeId: z.string().min(1, 'Tipe lapangan harus dipilih'),
    branchId: z.string().min(1, 'Cabang harus dipilih'),
    priceDay: z.string().min(1, 'Harga siang harus diisi').regex(/^\d+$/, 'Harga harus berupa angka'),
    priceNight: z.string().min(1, 'Harga malam harus diisi').regex(/^\d+$/, 'Harga harus berupa angka'),
    status: z.string().min(1, 'Status harus dipilih'),
});

type UpdateFieldFormValues = z.infer<typeof updateFieldSchema>;

export default function FieldEditPage() {
    const router = useRouter();
    const params = useParams<{ id: string; fieldId: string }>(); // Updated to match URL structure
    const { showError } = useToastHandler();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [field, setField] = useState<Field | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [fieldTypes, setFieldTypes] = useState<FieldType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBranchSelectionDisabled, setIsBranchSelectionDisabled] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [shouldRemoveImage, setShouldRemoveImage] = useState(false);
    const { showLoading, hideLoading, withLoading } = useGlobalLoading();

    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Extract both branch ID and field ID from URL
    const branchId = Number(params?.id);
    const fieldId = Number(params?.fieldId);

    const form = useForm<UpdateFieldFormValues>({
        resolver: zodResolver(updateFieldSchema),
        defaultValues: {
            name: '',
            typeId: '',
            branchId: '',
            priceDay: '',
            priceNight: '',
            status: '',
        },
    });

    // Effect to manage global loading state
    useEffect(() => {
        if (isLoading || isSubmitting) {
            showLoading();
        } else {
            hideLoading();
        }
    }, [isLoading, isSubmitting, showLoading, hideLoading]);

    useEffect(() => {
        const fetchData = async () => {
            if (isNaN(fieldId) || isNaN(branchId)) {
                showError('ID lapangan atau cabang tidak valid', 'Error ID Lapangan atau Cabang');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);

                // Fetch field data
                const fieldData = await withLoading(fieldApi.getFieldById(fieldId));
                setField(fieldData);

                if (fieldData) {
                    if (fieldData.imageUrl) {
                        setCurrentImageUrl(fieldData.imageUrl);
                    }

                    // Set form values from field data
                    form.setValue('name', fieldData.name);
                    form.setValue('typeId', fieldData.typeId ? fieldData.typeId.toString() : '');
                    form.setValue('branchId', fieldData.branchId ? fieldData.branchId.toString() : '');
                    form.setValue('priceDay', fieldData.priceDay ? fieldData.priceDay.toString() : '');
                    form.setValue('priceNight', fieldData.priceNight ? fieldData.priceNight.toString() : '');
                    form.setValue('status', fieldData.status || 'available');
                }

                // Fetch branch data using the branch ID from URL
                try {
                    const branchResponse = await branchApi.getBranchById(branchId);
                    const branchData = branchResponse.data;
                    
                    if (branchData) {
                        // Set branches array with the current branch
                        setBranches([branchData]);
                        // Auto-select the branch and disable selection
                        form.setValue('branchId', branchData.id.toString());
                        setIsBranchSelectionDisabled(true);
                    }
                } catch (branchError) {
                    showError(branchError, 'Gagal memuat data cabang. Silakan coba lagi.');
                    const branchesResponse = await branchApi.getUserBranches();
                    const branchesData = branchesResponse.data || [];
                    setBranches(branchesData);
                    setIsBranchSelectionDisabled(false);
                }

                // Fetch field types
                const fieldTypesData = await fieldApi.getFieldTypes();
                setFieldTypes(fieldTypesData || []);
                
            } catch (err) {
                showError(err, 'Gagal memuat data. Silakan coba lagi.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [fieldId, branchId, form, withLoading]);

    const handleRemoveImage = () => {
        // Reset selected image and preview
        setSelectedImage(null);
        setPreviewUrl(null);
        
        // Set flag to remove existing image
        if (currentImageUrl) {
            setShouldRemoveImage(true);
            // Reset currentImageUrl for UI
            setCurrentImageUrl(null);
        }
        
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            setShouldRemoveImage(false);

            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setSelectedImage(null);
            setPreviewUrl(null);
        }
    };

    const onSubmit = async (data: UpdateFieldFormValues) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const updateData: Record<string, unknown> = {
                name: data.name,
                typeId: parseInt(data.typeId),
                branchId: parseInt(data.branchId),
                priceDay: parseFloat(data.priceDay),
                priceNight: parseFloat(data.priceNight),
                status: data.status,
            };

            if (shouldRemoveImage && !selectedImage) {
                updateData.removeImage = true;
                await withLoading(fieldApi.updateField(fieldId, updateData));
            } else if (selectedImage) {
                const formData = new FormData();
                Object.entries(updateData).forEach(([key, value]) => {
                    formData.append(key, String(value));
                });
                formData.append('imageUrl', selectedImage);
                await withLoading(fieldApi.updateFieldWithImage(fieldId, formData));
            } else {
                await withLoading(fieldApi.updateField(fieldId, updateData));
            }

            // Navigate back to the branch detail page
            router.push(`/dashboard/branches/${branchId}`);
            
        } catch (err) {
            showError(err, 'Gagal memperbarui lapangan. Silakan coba lagi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        router.push(`/dashboard/branches/${branchId}`);
    };

    if (error && !field) {
        return (
            <div className="container mx-auto">
                <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
                    <p>{error}</p>
                </div>
                <Button onClick={handleBack}>Kembali</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Detail & Edit Lapangan</h1>
                <p className="text-gray-600 mt-2">
                    Cabang: {branches.length > 0 ? branches[0].name : 'Loading...'}
                </p>
            </div>

            {!isLoading && (
                <Card>
                    <CardHeader>
                        <CardTitle>Form Edit Lapangan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert variant="destructive" className="mb-6">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nama Lapangan</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Nama Lapangan" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="branchId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cabang</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                disabled={isBranchSelectionDisabled}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih cabang" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {branches.map((branch) => (
                                                        <SelectItem key={branch.id} value={branch.id.toString()}>
                                                            {branch.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="typeId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tipe Lapangan</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih tipe lapangan" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {fieldTypes.map((type) => (
                                                        <SelectItem key={type.id} value={type.id.toString()}>
                                                            {type.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="priceDay"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Harga Siang</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="100000" type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="priceNight"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Harga Malam</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="150000" type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="available">available</SelectItem>
                                                    <SelectItem value="booked">booked</SelectItem>
                                                    <SelectItem value="maintenance">maintenance</SelectItem>
                                                    <SelectItem value="closed">closed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-2">
                                    <FormLabel>Gambar Lapangan</FormLabel>
                                    <div className="flex flex-col items-center space-y-4 border-2 border-dashed border-gray-300 rounded-md p-6">
                                        {currentImageUrl && !previewUrl && !shouldRemoveImage ? (
                                            <div className="relative w-full max-w-xs">
                                                <Image
                                                    src={currentImageUrl}
                                                    alt="Current Image"
                                                    className="w-full h-auto rounded-md"
                                                    width={160}
                                                    height={160}
                                                />
                                                <p className="text-xs text-center mt-2 text-muted-foreground">
                                                    Gambar saat ini
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    className="absolute top-2 right-2"
                                                    onClick={handleRemoveImage}
                                                >
                                                    Hapus
                                                </Button>
                                            </div>
                                        ) : previewUrl ? (
                                            <div className="relative w-full max-w-xs">
                                                <Image
                                                    src={previewUrl}
                                                    alt="Preview"
                                                    className="w-full h-auto rounded-md"
                                                    width={500}
                                                    height={300}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    className="absolute top-2 right-2"
                                                    onClick={handleRemoveImage}
                                                >
                                                    Hapus
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-center">
                                                    <svg
                                                        className="mx-auto h-12 w-12 text-gray-400"
                                                        stroke="currentColor"
                                                        fill="none"
                                                        viewBox="0 0 48 48"
                                                        aria-hidden="true"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth="2"
                                                            d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6"
                                                        />
                                                    </svg>
                                                    <p className="mt-1 text-sm text-gray-600">
                                                        Tidak ada gambar
                                                    </p>
                                                </div>
                                            </>
                                        )}

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {currentImageUrl || previewUrl ? 'Ganti Gambar' : 'Unggah Gambar'}
                                        </Button>

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/png, image/jpeg, image/jpg"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                    >
                                        Kembali
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}

            {showDeleteDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Konfirmasi Penghapusan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-6">Apakah Anda yakin ingin menghapus lapangan ini? Tindakan ini tidak dapat dibatalkan.</p>
                            <div className="flex justify-end gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDeleteDialog(false)}
                                >
                                    Batal
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}