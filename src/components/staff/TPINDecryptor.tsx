import { Check, Copy, Eye, EyeOff, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { decryptText } from '../../lib/encryption';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface TPINDecryptorProps {
  className?: string;
}

export const TPINDecryptor: React.FC<TPINDecryptorProps> = ({ className = '' }) => {
  const [encryptedTPIN, setEncryptedTPIN] = useState('');
  const [decryptedTPIN, setDecryptedTPIN] = useState('');
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleDecrypt = () => {
    if (!encryptedTPIN.trim()) {
      setError('Please enter an encrypted TPIN');
      return;
    }

    try {
      const decrypted = decryptText(encryptedTPIN.trim());

      // Validate that decrypted TPIN is numeric and appropriate length
      if (!/^\d{4,6}$/.test(decrypted)) {
        setError('Decrypted value is not a valid TPIN format (4-6 digits)');
        setDecryptedTPIN('');
        return;
      }

      setDecryptedTPIN(decrypted);
      setError('');
      toast.success('TPIN decrypted successfully');
    } catch (err) {
      setError('Failed to decrypt TPIN. Please check if the input is valid encrypted text.');
      setDecryptedTPIN('');
      toast.error('TPIN decryption failed');
    }
  };

  const handleCopy = async () => {
    if (!decryptedTPIN) return;

    try {
      await navigator.clipboard.writeText(decryptedTPIN);
      setCopied(true);
      toast.success('TPIN copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy TPIN');
    }
  };

  const handleClear = () => {
    setEncryptedTPIN('');
    setDecryptedTPIN('');
    setError('');
    setShowDecrypted(false);
    setCopied(false);
  };

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          TPIN Decryptor
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Enter an encrypted TPIN to view its original numeric value
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="encrypted-tpin" className="text-sm font-medium">
            Encrypted TPIN
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="encrypted-tpin"
              type="text"
              placeholder="Enter encrypted TPIN"
              value={encryptedTPIN}
              onChange={e => setEncryptedTPIN(e.target.value)}
              className="flex-1 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleDecrypt}
                disabled={!encryptedTPIN.trim()}
                className="px-4 py-2 text-sm whitespace-nowrap"
              >
                Decrypt
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                className="px-4 py-2 text-sm whitespace-nowrap"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="text-sm">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {decryptedTPIN && (
          <div className="space-y-2">
            <Label htmlFor="decrypted-tpin" className="text-sm font-medium">
              Original TPIN
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input
                  id="decrypted-tpin"
                  type={showDecrypted ? 'text' : 'password'}
                  value={decryptedTPIN}
                  readOnly
                  className="pr-10 text-sm bg-muted/50 font-mono text-center text-lg tracking-widest"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowDecrypted(!showDecrypted)}
                >
                  {showDecrypted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showDecrypted ? 'Hide TPIN' : 'Show TPIN'}</span>
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={handleCopy}
                className="px-4 py-2 text-sm whitespace-nowrap flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              TPIN Length: {decryptedTPIN.length} digits
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TPINDecryptor;
