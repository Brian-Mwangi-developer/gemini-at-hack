import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <div className=" min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl font-bold text-center">
            Welcome to Gemigraph
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">Explore Intelligent Agents powered by Gemini and Langgraph and Africastalking</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center">
            Click below to get started with our agents
          </p>
          <Link href="/chat" className="block">
            <Button className="w-full font-semibold py-6 text-lg">
              Get Started
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


