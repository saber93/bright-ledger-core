import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ProductType = "goods" | "service" | "digital";
export type StockMovementType = "in" | "out" | "transfer" | "adjustment";

export interface Product {
  id: string;
  company_id: string;
  category_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  type: ProductType;
  unit: string;
  cost_price: number;
  sale_price: number;
  tax_rate: number;
  reorder_point: number;
  is_active: boolean;
  is_published: boolean;
  image_url: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  is_active: boolean;
}

export interface StockLevel {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  type: StockMovementType;
  quantity: number;
  reference: string | null;
  notes: string | null;
  occurred_at: string;
}

export interface ProductWithStock extends Product {
  category_name: string | null;
  total_stock: number;
  stock_by_warehouse: { warehouse_id: string; warehouse_name: string; quantity: number }[];
  is_low_stock: boolean;
}

export function useWarehouses() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["warehouses", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as Warehouse[];
    },
  });
}

export function useProductCategories() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["product-categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductCategory[];
    },
  });
}

export function useProductsWithStock() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["products-with-stock", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [productsRes, levelsRes, whRes, catsRes] = await Promise.all([
        supabase.from("products").select("*").eq("company_id", companyId!).order("name"),
        supabase.from("stock_levels").select("*").eq("company_id", companyId!),
        supabase.from("warehouses").select("id, name, code").eq("company_id", companyId!),
        supabase.from("product_categories").select("id, name").eq("company_id", companyId!),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (levelsRes.error) throw levelsRes.error;
      if (whRes.error) throw whRes.error;
      if (catsRes.error) throw catsRes.error;

      const products = (productsRes.data ?? []) as Product[];
      const levels = (levelsRes.data ?? []) as StockLevel[];
      const whMap = new Map((whRes.data ?? []).map((w) => [w.id, w.name as string]));
      const catMap = new Map((catsRes.data ?? []).map((c) => [c.id, c.name as string]));

      return products.map<ProductWithStock>((p) => {
        const productLevels = levels.filter((l) => l.product_id === p.id);
        const total_stock = productLevels.reduce((s, l) => s + Number(l.quantity), 0);
        const stock_by_warehouse = productLevels.map((l) => ({
          warehouse_id: l.warehouse_id,
          warehouse_name: whMap.get(l.warehouse_id) ?? "—",
          quantity: Number(l.quantity),
        }));
        const tracksStock = p.type === "goods";
        return {
          ...p,
          category_name: p.category_id ? catMap.get(p.category_id) ?? null : null,
          total_stock,
          stock_by_warehouse,
          is_low_stock: tracksStock && total_stock <= Number(p.reorder_point),
        };
      });
    },
  });
}

export function useProduct(id: string | undefined) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["product-detail", id],
    enabled: !!id && !!companyId,
    queryFn: async () => {
      const [productRes, levelsRes, movementsRes, whRes, catsRes] = await Promise.all([
        supabase.from("products").select("*").eq("id", id!).maybeSingle(),
        supabase.from("stock_levels").select("*").eq("product_id", id!),
        supabase
          .from("stock_movements")
          .select("*")
          .eq("product_id", id!)
          .order("occurred_at", { ascending: false })
          .limit(50),
        supabase.from("warehouses").select("id, name, code").eq("company_id", companyId!),
        supabase.from("product_categories").select("id, name").eq("company_id", companyId!),
      ]);
      if (productRes.error) throw productRes.error;
      if (!productRes.data) return null;
      const product = productRes.data as Product;

      const whMap = new Map((whRes.data ?? []).map((w) => [w.id, w.name as string]));
      const catMap = new Map((catsRes.data ?? []).map((c) => [c.id, c.name as string]));

      const levels = ((levelsRes.data ?? []) as StockLevel[]).map((l) => ({
        ...l,
        quantity: Number(l.quantity),
        warehouse_name: whMap.get(l.warehouse_id) ?? "—",
      }));
      const total_stock = levels.reduce((s, l) => s + l.quantity, 0);

      const movements = ((movementsRes.data ?? []) as StockMovement[]).map((m) => ({
        ...m,
        quantity: Number(m.quantity),
        warehouse_name: whMap.get(m.warehouse_id) ?? "—",
      }));

      return {
        product,
        category_name: product.category_id ? catMap.get(product.category_id) ?? null : null,
        levels,
        movements,
        total_stock,
        is_low_stock: product.type === "goods" && total_stock <= Number(product.reorder_point),
      };
    },
  });
}
