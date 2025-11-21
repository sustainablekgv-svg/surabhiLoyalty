import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { decryptText } from '../../lib/encryption';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface PasswordDecryptorProps {
  title?: string;
  description?: string;
  placeholder?: string;
  className?: string;
}

export const PasswordDecryptor: React.FC<PasswordDecryptorProps> = ({
  title = 'Password Decryptor',
  description = 'Enter an encrypted password to view its original value',
  placeholder = 'Enter encrypted password',
  className = '',
}) => {
  const [encryptedInput, setEncryptedInput] = useState('');
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleDecrypt = () => {
    if (!encryptedInput.trim()) {
      setError('Please enter an encrypted password');
      return;
    }

    try {
      const decrypted = decryptText(encryptedInput.trim());
      setDecryptedPassword(decrypted);
      setError('');
      toast.success('Password decrypted successfully');
    } catch (err) {
      setError('Failed to decrypt password. Please check if the input is valid encrypted text.');
      setDecryptedPassword('');
      toast.error('Decryption failed');
    }
  };

  const handleCopy = async () => {
    if (!decryptedPassword) return;

    try {
      await navigator.clipboard.writeText(decryptedPassword);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy password');
    }
  };

  const handleClear = () => {
    setEncryptedInput('');
    setDecryptedPassword('');
    setError('');
    setShowDecrypted(false);
    setCopied(false);
  };

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="encrypted-input" className="text-sm font-medium">
            Encrypted Password
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="encrypted-input"
              type="text"
              placeholder={placeholder}
              value={encryptedInput}
              onChange={e => setEncryptedInput(e.target.value)}
              className="flex-1 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleDecrypt}
                disabled={!encryptedInput.trim()}
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

        {decryptedPassword && (
          <div className="space-y-2">
            <Label htmlFor="decrypted-output" className="text-sm font-medium">
              Original Password
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input
                  id="decrypted-output"
                  type={showDecrypted ? 'text' : 'password'}
                  value={decryptedPassword}
                  readOnly
                  className="pr-10 text-sm bg-muted/50"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowDecrypted(!showDecrypted)}
                >
                  {showDecrypted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">
                    {showDecrypted ? 'Hide password' : 'Show password'}
                  </span>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PasswordDecryptor;
