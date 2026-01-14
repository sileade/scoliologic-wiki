import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  FileText,
  Search,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
  LogIn,
  BookOpen,
  Loader2,
} from "lucide-react";

export default function Home() {
  const { t } = useTranslation();
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Scoliologic Wiki</span>
          </div>
          
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" onClick={() => setLocation("/wiki")}>
                  {t("nav.wiki")}
                </Button>
                <Button variant="ghost" onClick={() => setLocation("/search")}>
                  {t("nav.search")}
                </Button>
                {user?.role === "admin" && (
                  <Button variant="ghost" onClick={() => setLocation("/admin")}>
                    {t("nav.admin")}
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center gap-2 pl-4 border-l">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user?.name?.charAt(0) || "U"}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{user?.name || "User"}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>
                <Button onClick={() => window.location.href = getLoginUrl()}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {t("auth.login")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            {t("home.heroTitle")}
            <br />
            <span className="text-primary">{t("home.heroPoweredBy")}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("home.heroDescription")}
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/wiki")}>
              <FileText className="h-5 w-5 mr-2" />
              {t("home.browseWiki")}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/search")}>
              <Search className="h-5 w-5 mr-2" />
              {t("common.search")}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-center mb-12">
          {t("home.keyFeatures")}
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <FileText className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t("home.features.editor.title")}</CardTitle>
              <CardDescription>
                {t("home.features.editor.description")}
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-none shadow-md">
            <CardHeader>
              <Sparkles className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t("home.features.ai.title")}</CardTitle>
              <CardDescription>
                {t("home.features.ai.description")}
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-none shadow-md">
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t("home.features.access.title")}</CardTitle>
              <CardDescription>
                {t("home.features.access.description")}
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-none shadow-md">
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t("home.features.collab.title")}</CardTitle>
              <CardDescription>
                {t("home.features.collab.description")}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Quick Access Section */}
      {isAuthenticated && (
        <section className="container py-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            {t("home.quickAccess")}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation("/wiki")}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t("home.browsePages")}</h3>
                    <p className="text-sm text-muted-foreground">{t("home.viewAllPages")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation("/search")}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t("home.aiSearch")}</h3>
                    <p className="text-sm text-muted-foreground">{t("home.findIntelligently")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {user?.role === "admin" && (
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation("/admin")}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t("admin.title")}</h3>
                      <p className="text-sm text-muted-foreground">{t("home.manageUsersGroups")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Scoliologic Group. {t("home.allRightsReserved")}</p>
          <p className="mt-1">{t("home.poweredBy")}</p>
        </div>
      </footer>
    </div>
  );
}
