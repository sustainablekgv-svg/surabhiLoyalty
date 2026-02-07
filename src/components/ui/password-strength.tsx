import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Progress } from '@/components/ui/progress';

interface PasswordStrengthProps {
  password: string;
  onValidationChange: (isValid: boolean) => void;
}

export const PasswordStrengthIndicator = ({ password, onValidationChange }: PasswordStrengthProps) => {
  const [strength, setStrength] = useState(0);
  const [requirements, setRequirements] = useState({
    length: false,
    number: false,
    special: false,
    uppercase: false,
  });

  useEffect(() => {
    const checks = {
      length: password.length >= 6,
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      uppercase: /[A-Z]/.test(password),
    };

    setRequirements(checks);

    const passedChecks = Object.values(checks).filter(Boolean).length;
    
    // Calculate strength score (0-100)
    // Length is mandatory for any strength
    if (!checks.length) {
      setStrength(passedChecks * 10); // Low score if length not met
    } else {
      setStrength(passedChecks * 25);
    }

    // Only consider valid if all requirements are met (or relax requirements as needed)
    // User requested "property strength checks", assuming standard strong password policy
    const isValid = checks.length; // Minimum requirement is length 6 as per previous context
    // But for "proper strength", let's enforce at least one other check or just strong visual feedback?
    // Let's enforce length + at least 2 other criteria for "Strong", but allow saving if length is met (6 chars)
    // aligned with Firebase's 6 char min.
    // However, user said "make sure proper strength checks are done".
    // Let's enforce: Length >= 6 AND (Number OR Special OR Uppercase)
    const isStrongEnough = checks.length && (checks.number || checks.special || checks.uppercase);
    
    onValidationChange(isStrongEnough);

  }, [password, onValidationChange]);

  const getColor = () => {
    if (strength <= 25) return 'bg-red-500';
    if (strength <= 50) return 'bg-orange-500';
    if (strength <= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-2 mt-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Password Strength</span>
        <span>{strength < 50 ? 'Weak' : strength < 75 ? 'Medium' : 'Strong'}</span>
      </div>
      <Progress value={strength} className={`h-1.5 transition-all ${getColor()}`} />
      
      <div className="grid grid-cols-2 gap-1 mt-2">
        <RequirementItem met={requirements.length} label="Min 6 chars" />
        <RequirementItem met={requirements.number} label="Number (0-9)" />
        <RequirementItem met={requirements.special} label="Special Char" />
        <RequirementItem met={requirements.uppercase} label="Uppercase (A-Z)" />
      </div>
    </div>
  );
};

const RequirementItem = ({ met, label }: { met: boolean; label: string }) => (
  <div className={`flex items-center text-[10px] xs:text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
    {met ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
    {label}
  </div>
);
