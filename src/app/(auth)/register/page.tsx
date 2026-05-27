"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema } from "@/lib/validations";

type FormData = z.infer<typeof registerSchema>;

const TASHKENT = { lat: 41.2995, lng: 69.2401 };

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      latitude: TASHKENT.lat,
      longitude: TASHKENT.lng,
    },
  });

  async function nextStep() {
    const fields: (keyof FormData)[] =
      step === 1 ? ["name", "email", "password"] : ["shopName", "ownerName", "phone", "address"];
    const ok = await trigger(fields);
    if (ok) setStep((s) => s + 1);
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Registration failed");
        return;
      }
      toast.success("Registered! Wait for admin approval to sign in.");
      router.push("/onboarding");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size={48} />
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-center">Create account</CardTitle>
            <CardDescription className="text-center">
              Step {step} of 3 —{" "}
              {step === 1 ? "Account info" : step === 2 ? "Shop details" : "Location"}
            </CardDescription>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input placeholder="John Smith" {...register("name")} />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="you@example.com" {...register("email")} />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="Min 6 characters"
                      {...register("password")}
                    />
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label>Shop name</Label>
                    <Input placeholder="My Grocery Shop" {...register("shopName")} />
                    {errors.shopName && (
                      <p className="text-xs text-destructive">{errors.shopName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Owner name</Label>
                    <Input placeholder="Owner full name" {...register("ownerName")} />
                    {errors.ownerName && (
                      <p className="text-xs text-destructive">{errors.ownerName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input placeholder="+998 90 123 4567" {...register("phone")} />
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input placeholder="Street, district, city" {...register("address")} />
                    {errors.address && (
                      <p className="text-xs text-destructive">{errors.address.message}</p>
                    )}
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Enter your shop's GPS coordinates. You can find them in Google Maps by
                      right-clicking your location.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="41.2995"
                        {...register("latitude", { valueAsNumber: true })}
                      />
                      {errors.latitude && (
                        <p className="text-xs text-destructive">{errors.latitude.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="69.2401"
                        {...register("longitude", { valueAsNumber: true })}
                      />
                      {errors.longitude && (
                        <p className="text-xs text-destructive">{errors.longitude.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <div className="flex gap-2 w-full">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => s - 1)}
                    className="flex-1"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Register
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
