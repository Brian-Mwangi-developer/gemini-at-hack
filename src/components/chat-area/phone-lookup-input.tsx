"use client";

import { cn } from "@/lib/utils";
import { IconSend } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { PhoneInput, parseCountry, defaultCountries } from "react-international-phone";
import "react-international-phone/style.css";
import { toast } from "sonner";

interface PhoneLookupInputProps {
    onClose: () => void;
}

// Build a dial-code lookup from the default country data
const DIAL_CODES = new Map(
    defaultCountries.map((c) => {
        const parsed = parseCountry(c);
        return [parsed.iso2, parsed.dialCode];
    }),
);

export const PhoneLookupInput = memo(function PhoneLookupInput({
    onClose,
}: PhoneLookupInputProps) {
    const [phone, setPhone] = useState("");
    const [countryIso2, setCountryIso2] = useState("ke");
    const [sending, setSending] = useState(false);
    const [touched, setTouched] = useState(false);

   
    const [chatUrl, setChatUrl] = useState("");
    useEffect(() => {
        const base = process.env.NEXT_PUBLIC_APP_URL;
        if (base) {
            setChatUrl(`${base.replace(/\/$/, '')}${window.location.pathname}`);
        } else {
            setChatUrl(window.location.href);
        }
    }, []);

    // Derive national digits (everything after the dial code)
    const dialCode = DIAL_CODES.get(countryIso2) ?? "";
    const allDigits = phone.replace(/\D/g, "");
    const nationalDigits = dialCode && allDigits.startsWith(dialCode)
        ? allDigits.slice(dialCode.length)
        : allDigits;

    const isValid = nationalDigits.length === 9;
    const showError = touched && !isValid && phone.length > 1;

    const handleSend = useCallback(async () => {
        if (!isValid || sending) return;
        setTouched(true);

        setSending(true);
        try {
            const formattedPhone = "+" + phone.replace(/\D/g, "");
            const res = await fetch("/api/send-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phoneNumber: formattedPhone,
                    chatUrl,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("SMS sent successfully!");
                onClose();
            } else {
                toast.error(data.message ?? "Failed to send SMS");
            }
        } catch {
            toast.error("Network error — could not send SMS");
        } finally {
            setSending(false);
        }
    }, [isValid, sending, phone, chatUrl, onClose]);

    return (
        <div className="flex flex-col gap-3 w-full">
            <p className="text-sm font-medium text-foreground">
                Enter your phone number to receive this research via SMS
            </p>

            <div className="flex flex-col gap-1.5">
                <div
                    className={cn(
                        "rounded-lg border transition-colors [&_.react-international-phone-input-container]:border-0! [&_.react-international-phone-input-container]:bg-transparent! [&_.react-international-phone-input]:bg-transparent! [&_.react-international-phone-input]:text-foreground! [&_.react-international-phone-input]:text-sm! [&_.react-international-phone-country-selector-button]:bg-transparent! [&_.react-international-phone-country-selector-button]:border-0!",
                        showError
                            ? "border-destructive ring-1 ring-destructive/30"
                            : "border-border focus-within:border-primary",
                    )}
                >
                    <PhoneInput
                        defaultCountry="ke"
                        value={phone}
                        onChange={(val, meta) => {
                            setPhone(val);
                            if (meta.country.iso2) setCountryIso2(meta.country.iso2);
                            if (!touched) setTouched(true);
                        }}
                        inputProps={{
                            placeholder: "Enter phone number",
                            className: "flex-1 outline-none",
                        }}
                    />
                </div>

                {showError && (
                    <p className="text-xs text-destructive">
                        Phone number must be exactly 9 digits after the country code
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSend}
                    disabled={!isValid || sending}
                    className={cn(
                        "flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-200",
                        isValid && !sending
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                            : "bg-secondary text-muted-foreground cursor-not-allowed",
                    )}
                >
                    <IconSend className="size-4" />
                    {sending ? "Sending…" : "Send SMS"}
                </button>
            </div>
        </div>
    );
});
