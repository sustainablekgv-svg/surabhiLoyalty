import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { uploadImageToR2 } from '@/services/cloudflare';
import { Banner } from '@/types/shop';
import { getBanners, addBanner, updateBanner, deleteBanner, updateBannerOrders } from '@/services/banner';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';

export const BannerManager = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const data = await getBanners();
      setBanners(data);
    } catch (error) {
      console.error('Failed to fetch banners', error);
      toast({ title: 'Error', description: 'Failed to fetch banners', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const imageUrl = await uploadImageToR2(file, 'banners');
      
      const newBannerOrder = banners.length > 0 ? Math.max(...banners.map(b => b.displayOrder)) + 1 : 0;
      
      await addBanner({
        imageUrl,
        displayOrder: newBannerOrder,
        isActive: true,
        linkUrl: ''
      });

      toast({ title: 'Success', description: 'Banner added successfully' });
      fetchBanners();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload banner', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, { isActive: !banner.isActive });
      setBanners(banners.map(b => b.id === banner.id ? { ...b, isActive: !banner.isActive } : b));
      toast({ title: 'Success', description: `Banner ${banner.isActive ? 'deactivated' : 'activated'}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update banner status', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await deleteBanner(id);
      setBanners(banners.filter(b => b.id !== id));
      toast({ title: 'Success', description: 'Banner deleted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete banner', variant: 'destructive' });
    }
  };

  const handleUpdateLink = async (banner: Banner, newLink: string) => {
    try {
      await updateBanner(banner.id, { linkUrl: newLink });
      setBanners(banners.map(b => b.id === banner.id ? { ...b, linkUrl: newLink } : b));
      toast({ title: 'Success', description: 'Banner link updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update link', variant: 'destructive' });
    }
  };

  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === banners.length - 1)
    ) return;

    const newBanners = [...banners];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap elements
    [newBanners[index], newBanners[swapIndex]] = [newBanners[swapIndex], newBanners[index]];
    
    setBanners(newBanners);

    try {
      await updateBannerOrders(newBanners);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save new order', variant: 'destructive' });
      fetchBanners(); // revert on fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Banners Management</CardTitle>
          <CardDescription>Upload and arrange banners for the landing page carousel.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Upload Banner
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {banners.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No banners added yet.</p>
            <p className="text-sm">Click 'Upload Banner' to add your first banner.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {banners.map((banner, index) => (
              <div 
                key={banner.id} 
                className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-white border rounded-lg shadow-sm"
              >
                <div className="flex-shrink-0 w-full md:w-48 h-32 relative bg-gray-100 rounded overflow-hidden">
                  <img 
                    src={banner.imageUrl} 
                    alt={`Banner ${index}`} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png' }}
                  />
                </div>
                
                <div className="flex-grow space-y-3 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={banner.isActive} 
                        onCheckedChange={() => handleToggleActive(banner)} 
                        id={`active-${banner.id}`}
                      />
                      <label htmlFor={`active-${banner.id}`} className="text-sm font-medium">
                        {banner.isActive ? 'Active' : 'Hidden'}
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon"
                        disabled={index === 0}
                        onClick={() => moveBanner(index, 'up')}
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        disabled={index === banners.length - 1}
                        onClick={() => moveBanner(index, 'down')}
                        title="Move Down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="icon"
                        className="ml-2"
                        onClick={() => handleDelete(banner.id)}
                        title="Delete Banner"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-gray-400" />
                    <input 
                      type="url" 
                      placeholder="Optional link URL (e.g. https://example.com/product/1)"
                      className="flex-1 text-sm border rounded px-2 py-1"
                      defaultValue={banner.linkUrl || ''}
                      onBlur={(e) => {
                        if (e.target.value !== banner.linkUrl) {
                          handleUpdateLink(banner, e.target.value);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
