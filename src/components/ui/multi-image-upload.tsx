import { cn } from '@/lib/utils';
import { deleteImageFromR2, uploadImageToR2 } from '@/services/cloudflare';
import { GripVertical, Upload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './button';

interface MultiImageUploadProps {
    images: string[];
    onChange: (images: string[]) => void;
    folder: string;
    maxImages?: number;
    disabled?: boolean;
}

export const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
    images,
    onChange,
    folder,
    maxImages = 10,
    disabled = false,
}) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || disabled) return;

        const fileArray = Array.from(files);
        const remainingSlots = maxImages - images.length;

        if (fileArray.length > remainingSlots) {
            toast.error(`You can only upload ${remainingSlots} more image(s). Maximum is ${maxImages}.`);
            return;
        }

        setUploading(true);
        const newImages: string[] = [];

        for (const file of fileArray) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error(`${file.name} is not an image file`);
                continue;
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error(`${file.name} exceeds 5MB limit`);
                continue;
            }

            try {
                setUploadProgress(prev => ({ ...prev, [file.name]: true }));
                const url = await uploadImageToR2(file, folder);
                newImages.push(url);
                setUploadProgress(prev => {
                    const updated = { ...prev };
                    delete updated[file.name];
                    return updated;
                });
            } catch (error: any) {
                toast.error(`Failed to upload ${file.name}: ${error.message}`);
                setUploadProgress(prev => {
                    const updated = { ...prev };
                    delete updated[file.name];
                    return updated;
                });
            }
        }

        if (newImages.length > 0) {
            onChange([...images, ...newImages]);
            toast.success(`${newImages.length} image(s) uploaded successfully`);
        }

        setUploading(false);
    };

    const handleDelete = async (index: number) => {
        if (disabled) return;

        const imageToDelete = images[index];
        
        try {
            // Delete from R2
            await deleteImageFromR2(imageToDelete);
            
            // Remove from array
            const newImages = images.filter((_, i) => i !== index);
            onChange(newImages);
            toast.success('Image deleted');
        } catch (error: any) {
            toast.error(`Failed to delete image: ${error.message}`);
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newImages = [...images];
        const draggedImage = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedImage);

        onChange(newImages);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (disabled) return;

        const files = e.dataTransfer.files;
        handleFileSelect(files);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            {images.length < maxImages && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragEnter}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary",
                        uploading && "pointer-events-none opacity-50"
                    )}
                    onClick={() => !disabled && fileInputRef.current?.click()}
                >
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">
                        Drag and drop images here, or click to select
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {images.length} / {maxImages} images • Max 5MB per image
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        disabled={disabled}
                    />
                </div>
            )}

            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
                <div className="space-y-2">
                    {Object.keys(uploadProgress).map((filename) => (
                        <div key={filename} className="flex items-center gap-2 text-sm">
                            <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-pulse w-full" />
                            </div>
                            <span className="text-muted-foreground text-xs">{filename}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                        <div
                            key={`${image}-${index}`}
                            draggable={!disabled}
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                                "relative group rounded-lg overflow-hidden border-2 transition-all",
                                draggedIndex === index && "opacity-50",
                                !disabled && "cursor-move",
                                index === 0 && "ring-2 ring-primary ring-offset-2"
                            )}
                        >
                            {/* Primary Badge */}
                            {index === 0 && (
                                <div className="absolute top-2 left-2 z-10">
                                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md font-medium">
                                        Primary
                                    </span>
                                </div>
                            )}

                            {/* Drag Handle */}
                            {!disabled && (
                                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-black/50 rounded p-1">
                                        <GripVertical className="h-4 w-4 text-white" />
                                    </div>
                                </div>
                            )}

                            {/* Image */}
                            <img
                                src={image}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-32 object-cover"
                            />

                            {/* Delete Button */}
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute bottom-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDelete(index)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}

                            {/* Index */}
                            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                {index + 1}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Helper Text */}
            {images.length > 0 && !disabled && (
                <p className="text-xs text-muted-foreground">
                    💡 Drag images to reorder. The first image is the primary image.
                </p>
            )}
        </div>
    );
};
