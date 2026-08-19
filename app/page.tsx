"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Boxes, ShoppingBag, Store, CreditCard, WalletCards, Settings,
  Plus, Download, Search, Truck, X, Menu, LogOut, Camera, UserRound, RefreshCw,
  ShieldCheck, PackageCheck, Plane, Landmark, CheckCircle2, Edit3, History,
  AlertTriangle, Save, Trash2, Receipt, CircleDollarSign, ChevronRight,
  Images, Star, Upload, ExternalLink, Smartphone, BadgeCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "ADMIN" | "GM" | "CEO";
type View = "dashboard" | "inventory" | "purchases" | "platforms" | "sales" | "cash" | "settings";
type BatchStatus = "매입중" | "매입완료" | "출고대기" | "국제배송중" | "한국도착" | "통관중" | "통관완료" | "국내배송중" | "입고완료" | "보류";
type ProductStatus = "입고전" | "입고완료" | "촬영대기" | "판매중" | "예약" | "판매완료" | "반품" | "보류";

type Product = {
  id:string; batch:string; date:string; brand:string; category:string; name:string;
  size?:string; color?:string; material?:string; grade?:string; status:ProductStatus; logisticsStatus:BatchStatus;
  purchaseType:string; location?:string; source?:string; auction?:string; ems?:string; bundle?:string;
  cost:number; firstPayment?:number; secondPayment?:number; importDuty?:number; importVat?:number;
  customsFee?:number; otherImportCost?:number; commonCost:number; totalCost:number;
  expectedPrice?:number; soldPrice?:number; imagePath?:string; note?:string;
  receivedAt?:string; listedAt?:string; soldAt?:string; platforms:string[];
};

type Batch = {
  id:string; purchaseType:string; date:string; source:string; bundle?:string; ems?:string;
  count:number; cost:number; status:BatchStatus; note?:string; carrier?:string; domesticTracking?:string;
  statusUpdatedAt?:string; customsEnteredAt?:string; customsClearedAt?:string; receivedAt?:string;
  internationalShipping:number; serviceFee:number; storageFee:number; customsDuty:number;
  importVat:number; clearanceFee:number; domesticShipping:number; travelCost:number; otherCost:number;
  expectedProductCount:number; purchaseCurrency:string; purchaseAmountLocal:number; fxRate:number;
};

type ProductImage = {
  id:string; productId:string; path:string; originalName?:string; mimeType?:string; sizeBytes?:number;
  sortOrder:number; isPrimary:boolean; createdAt:string; signedUrl:string;
};
type PlatformAccount = {
  platform:string; storeName?:string; loginId?:string; profileCode?:string; joinedAt?:string; verified:boolean;
  active:boolean; priority:number; metrics:Record<string,any>; note?:string;
};

type PurchaseInboxStatus = "구매확정" | "1차결제완료" | "현지배송중" | "현지배송완료" | "대행창고보관" | "묶음배송선택" | "2차결제대기" | "배치전환완료" | "보류" | "취소";
type PurchaseInboxItem = {
  id:string; externalId:string; sourceSystem:string; purchaseMethod:string; status:PurchaseInboxStatus; purchaseAt?:string;
  brand?:string; category:string; name:string; auction?:string; seller?:string; pureJpy:number; firstPaymentKrw:number;
  weightG:number; localShippingDate?:string; warehouseArrivedAt?:string; sourceNote?:string; dataQuality:string;
  batchId?:string; productId?:string; convertedAt?:string; createdAt:string; updatedAt:string;
};

type Listing = { id:string; productId:string; platform:string; price:number; status:string; url?:string };
type Sale = {
  id:string; productId:string; channel:string; date:string; gross:number; discount:number;
  fee:number; paymentFee:number; shipping:number; other:number; net:number; settled?:number;
  status:string; paymentMethod?:string; note?:string;
};
type Expense = {
  id:string; date:string; category:string; amount:number; batch?:string; allocationMethod?:string;
  accountingCost:boolean; managementCost:boolean; note?:string;
};
type StatusEvent = {
  id:string; entityType:string; entityId:string; fromStatus?:string; toStatus:string;
  note?:string; actor?:string; createdAt:string;
};
type UserProfile = { loginId:string; name:string; role:Role };

const VERSION = "0.6.0";
const ACCOUNT_MAP:Record<string,UserProfile> = {
  admin:{loginId:"admin",name:"ADMIN",role:"ADMIN"},
  jedilick:{loginId:"jedilick",name:"정환재",role:"GM"},
  susan98302:{loginId:"susan98302",name:"이송민",role:"CEO"},
};
const emailFor=(id:string)=>`${id.toLowerCase()}@smeverflow.com`;
const won=(n:number)=>new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(n||0);
const yen=(n:number)=>`¥${new Intl.NumberFormat("ja-JP",{maximumFractionDigits:0}).format(n||0)}`;
const nval=(v:FormDataEntryValue|null)=>Number(v||0);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

const BATCH_STEPS:BatchStatus[]=["매입중","매입완료","출고대기","국제배송중","한국도착","통관중","통관완료","국내배송중","입고완료"];
const PRODUCT_STATUSES:ProductStatus[]=["입고전","입고완료","촬영대기","판매중","예약","판매완료","반품","보류"];
const PURCHASE_INBOX_STEPS:PurchaseInboxStatus[]=["구매확정","1차결제완료","현지배송중","현지배송완료","대행창고보관","묶음배송선택","2차결제대기"];
const PURCHASE_INBOX_ACTIVE = new Set<PurchaseInboxStatus>(["구매확정","1차결제완료","현지배송중","현지배송완료","대행창고보관","묶음배송선택","2차결제대기"]);
const BUNDLE_READY_STATUSES = new Set<PurchaseInboxStatus>(["현지배송완료","대행창고보관","묶음배송선택","2차결제대기"]);
const nav = [
  ["dashboard","대시보드",LayoutDashboard],
  ["inventory","상품·재고",Boxes],
  ["purchases","매입·수입",ShoppingBag],
  ["platforms","플랫폼 등록",Store],
  ["sales","판매·정산",CreditCard],
  ["cash","금전·비용",WalletCards],
  ["settings","설정",Settings],
] as const;

function isJwtTimeError(message?:string){ return !!message && /JWT issued at future|not yet valid|invalid jwt/i.test(message); }

function parsePurchaseImport(text:string,defaultStatus:PurchaseInboxStatus){
  const clean=text.replace(/\r/g,"").trim();
  const detected:PurchaseInboxStatus=clean.includes("현지배송완료")?"현지배송완료":clean.includes("현지배송중")?"현지배송중":clean.includes("1차결제완료")?"1차결제완료":defaultStatus;
  const rows:any[]=[];
  const tsv=clean.split("\n").map(x=>x.trim()).filter(Boolean).filter(x=>x.includes("\t"));
  if(tsv.length){
    for(const line of tsv){
      const [externalId,status,brand,name,jpy,krw,auction,date,weight]=line.split("\t").map(x=>x.trim());
      if(!externalId||!name)continue;
      rows.push({source_system:"merujg",external_id:externalId,purchase_method:"일본경매직구",status:status||detected,brand:brand||null,category:"기타",product_name:name,auction_no:auction||null,pure_item_price_jpy:Number((jpy||"0").replaceAll(",",""))||0,first_payment_krw:Number((krw||"0").replaceAll(",",""))||0,local_weight_g:Number((weight||"0").replace(/[^0-9.]/g,""))||0,local_shipping_date:date||null,source_note:"일괄 TSV 가져오기",data_quality:"import"});
    }
    return rows;
  }
  const matches=[...clean.matchAll(/고유번호\s*[:：]\s*(\d+)/g)];
  for(let i=0;i<matches.length;i++){
    const m=matches[i];
    const start=m.index||0;
    const next=matches[i+1]?.index??clean.length;
    const prefix=clean.slice(Math.max(0,start-360),start);
    const detail=clean.slice(start,next);
    const combined=prefix+"\n"+detail;
    const externalId=m[1];
    const auction=(detail.match(/경매번호\s*[:：]\s*([A-Za-z0-9_-]+)/)||[])[1]||null;
    const krw1=(detail.match(/결제(?:된)?\s*금액\s*[:：]\s*[₩￦]?\s*([\d,]+)/)||[])[1];
    const krw2=(detail.match(/JPY\s*[\d,]+\s*x?\s*1?\s*[₩￦¥]\s*([\d,]{4,})/i)||[])[1];
    const jpy1=(detail.match(/순수물품대금\s*[:：]\s*(?:JPY|[¥￥])?\s*([\d,]+)/i)||[])[1];
    const jpy2=(detail.match(/결제대금\s*[:：]\s*JPY\s*([\d,]+)/i)||[])[1];
    const localDate=(detail.match(/현지배송일\s*[:：]\s*(\d{4}-\d{2}-\d{2})/)||[])[1]||null;
    const weight=(detail.match(/중량\s*[:：]\s*([\d,.]+)\s*g/i)||[])[1];
    const purchaseAt=(detail.match(/구매\/종료일\s*[:：][^/\n]*\/\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)||[])[1]||null;
    const knownBrands=["RED VALENTINO","NINA RICCI","Max Mara","MAX MARA","ENFOLD","ISABEL MARANT ETOILE","CEDRIC CHARLIER","self-portrait","WEEKEND Max Mara"];
    const brand=knownBrands.find(b=>combined.toLowerCase().includes(b.toLowerCase()))||"";
    const candidateLines=prefix.split("\n").map(x=>x.trim()).filter(x=>x.length>4&&!/상태|리스트|상세보기|신청체크|묶음NO|배송방법/.test(x));
    const title=[...candidateLines].reverse().find(x=>brand?x.toLowerCase().includes(brand.toLowerCase()):true)||`${brand||"일본매입"} ${externalId}`;
    rows.push({source_system:"merujg",external_id:externalId,purchase_method:"일본경매직구",status:detected,purchase_at:purchaseAt?purchaseAt.replace(" ","T")+"+09:00":null,brand:brand||null,category:"기타",product_name:title.slice(0,500),auction_no:auction,pure_item_price_jpy:Number((jpy1||jpy2||"0").replaceAll(",",""))||0,first_payment_krw:Number((krw1||krw2||"0").replaceAll(",",""))||0,local_weight_g:Number((weight||"0").replaceAll(",",""))||0,local_shipping_date:localDate,source_note:"대행사이트 원문 자동파싱 · 등록 후 검수 권장",data_quality:"parsed"});
  }
  return rows;
}

export default function Page(){
  const [session,setSession]=useState<Session|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [loginId,setLoginId]=useState("");
  const [password,setPassword]=useState("");
  const [loginError,setLoginError]=useState("");
  const [view,setView]=useState<View>("dashboard");
  const [products,setProducts]=useState<Product[]>([]);
  const [batches,setBatches]=useState<Batch[]>([]);
  const [listings,setListings]=useState<Listing[]>([]);
  const [sales,setSales]=useState<Sale[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [events,setEvents]=useState<StatusEvent[]>([]);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("전체");
  const [mobile,setMobile]=useState(false);
  const [loading,setLoading]=useState(false);
  const [warnings,setWarnings]=useState<string[]>([]);
  const [modal,setModal]=useState<{type:string; id?:string; ids?:string[]}|null>(null);
  const [imageUrls,setImageUrls]=useState<Record<string,string>>({});
  const [productImages,setProductImages]=useState<Record<string,ProductImage[]>>({});
  const [platformAccounts,setPlatformAccounts]=useState<PlatformAccount[]>([]);
  const [purchaseInbox,setPurchaseInbox]=useState<PurchaseInboxItem[]>([]);
  const [uploadingId,setUploadingId]=useState<string|null>(null);
  const quickFile=useRef<HTMLInputElement|null>(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);setAuthLoading(false)});
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{ if(session) void loadAll(); },[session]);

  const currentId=session?.user.email?.split("@")[0]||"";
  const user=ACCOUNT_MAP[currentId]||{loginId:currentId,name:currentId||"User",role:"GM" as Role};
  const inventory=products.filter(p=>p.status!=="판매완료" && p.status!=="반품");
  const verified=inventory.reduce((a,b)=>a+b.cost,0);
  const total=inventory.reduce((a,b)=>a+b.totalCost,0);
  const gross=sales.reduce((a,b)=>a+b.gross,0);
  const settled=sales.reduce((a,b)=>a+(b.settled??0),0);
  const pending=sales.filter(s=>s.status!=="정산완료").reduce((a,b)=>a+b.net,0);
  const inTransit=products.filter(p=>p.logisticsStatus!=="입고완료"&&p.logisticsStatus!=="보류").length;
  const activeListings=listings.filter(l=>l.status==="판매중").length;
  const activeInbox=purchaseInbox.filter(x=>PURCHASE_INBOX_ACTIVE.has(x.status));
  const awaitingWarehouse=activeInbox.filter(x=>["구매확정","1차결제완료","현지배송중"].includes(x.status)).length;
  const warehouseReady=activeInbox.filter(x=>["현지배송완료","대행창고보관","묶음배송선택","2차결제대기"].includes(x.status)).length;
  const inboxPaid=activeInbox.reduce((a,b)=>a+b.firstPaymentKrw,0);
  const trackedAssets=inventory.length+activeInbox.length;
  const filtered=useMemo(()=>products.filter(p=>{
    const text=`${p.id} ${p.brand} ${p.name} ${p.batch}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (statusFilter==="전체" || p.status===statusFilter);
  }),[products,query,statusFilter]);

  async function retryQuery(run:()=>PromiseLike<any>){
    let res=await run();
    if(res?.error && isJwtTimeError(res.error.message)){
      await sleep(1200);
      await supabase.auth.refreshSession();
      res=await run();
    }
    return res;
  }

  async function login(e:React.FormEvent){
    e.preventDefault(); setLoginError("");
    const id=loginId.trim().toLowerCase();
    if(!ACCOUNT_MAP[id]){setLoginError("등록되지 않은 ID입니다.");return;}
    const {error}=await supabase.auth.signInWithPassword({email:emailFor(id),password});
    if(error)setLoginError("ID 또는 비밀번호를 확인해 주세요.");
  }
  async function logout(){ await supabase.auth.signOut(); }

  async function loadAll(){
    setLoading(true); setWarnings([]);
    const results=await Promise.all([
      retryQuery(()=>supabase.from("products").select("*").order("created_at",{ascending:false})),
      retryQuery(()=>supabase.from("batches").select("*").order("batch_date",{ascending:false})),
      retryQuery(()=>supabase.from("listings").select("*").order("created_at",{ascending:false})),
      retryQuery(()=>supabase.from("sales").select("*").order("sold_at",{ascending:false})),
      retryQuery(()=>supabase.from("expenses").select("*").order("expense_date",{ascending:false})),
      retryQuery(()=>supabase.from("status_events").select("*").order("created_at",{ascending:false}).limit(200)),
      retryQuery(()=>supabase.from("product_images").select("*").order("sort_order",{ascending:true}).order("image_id",{ascending:true})),
      retryQuery(()=>supabase.from("platform_accounts").select("*").order("priority",{ascending:true})),
      retryQuery(()=>supabase.from("purchase_inbox").select("*").order("created_at",{ascending:false})),
    ]);
    const labels=["상품","배치","플랫폼","판매","비용","상태이력","상품사진","플랫폼계정","일본구매대기함"];
    const bad:string[]=[];
    results.forEach((r,i)=>{if(r.error)bad.push(`${labels[i]}: ${r.error.message}`)});
    setWarnings(bad);

    const [p,b,l,s,e,ev,img,pa,pi]=results;
    let listingRows=listings;
    if(!l.error){
      listingRows=(l.data||[]).map((r:any)=>({id:String(r.listing_id),productId:r.product_id,platform:r.platform,price:Number(r.listing_price||0),status:r.status,url:r.url||""}));
      setListings(listingRows);
    }
    if(!p.error){
      const rows:Product[]=(p.data||[]).map((r:any)=>({
        id:r.product_id,batch:r.batch_id||"",date:r.purchase_date,brand:r.brand,category:r.category,name:r.product_name,
        size:r.size||"",color:r.color||"",material:r.material||"",grade:r.grade||"",status:r.inventory_status as ProductStatus,logisticsStatus:(r.logistics_status||"입고완료") as BatchStatus,
        purchaseType:r.purchase_type,location:r.location||"",source:r.source||"",auction:r.auction_no||"",ems:r.ems||"",bundle:r.bundle_no||"",
        cost:Number(r.verified_cost||0),firstPayment:r.first_payment==null?undefined:Number(r.first_payment),
        secondPayment:r.second_payment==null?undefined:Number(r.second_payment),importDuty:r.import_duty==null?undefined:Number(r.import_duty),
        importVat:r.import_vat==null?undefined:Number(r.import_vat),customsFee:r.customs_fee==null?undefined:Number(r.customs_fee),
        otherImportCost:r.other_import_cost==null?undefined:Number(r.other_import_cost),commonCost:Number(r.allocated_common_cost||0),
        totalCost:Number(r.total_cost||0),expectedPrice:r.expected_price==null?undefined:Number(r.expected_price),
        soldPrice:r.sold_price==null?undefined:Number(r.sold_price),imagePath:r.image_url||"",note:r.note||"",
        receivedAt:r.received_at||"",listedAt:r.listed_at||"",soldAt:r.sold_at||"",
        platforms:listingRows.filter(x=>x.productId===r.product_id&&x.status==="판매중").map(x=>x.platform),
      }));
      setProducts(rows);
      if(img.error) await hydrateLegacyImages(rows);
    }
    if(!b.error)setBatches((b.data||[]).map((r:any)=>({
      id:r.batch_id,purchaseType:r.purchase_type,date:r.batch_date,source:r.source,bundle:r.bundle_no||"",ems:r.tracking_no||"",
      count:Number(r.product_count||0),cost:Number(r.verified_cost||0),status:r.status as BatchStatus,note:r.note||"",carrier:r.carrier||"EMS",
      domesticTracking:r.domestic_tracking_no||"",statusUpdatedAt:r.status_updated_at||"",customsEnteredAt:r.customs_entered_at||"",
      customsClearedAt:r.customs_cleared_at||"",receivedAt:r.received_at||"",internationalShipping:Number(r.international_shipping||0),
      serviceFee:Number(r.service_fee||0),storageFee:Number(r.storage_fee||0),customsDuty:Number(r.customs_duty||0),
      importVat:Number(r.import_vat||0),clearanceFee:Number(r.clearance_fee||0),domesticShipping:Number(r.domestic_shipping||0),
      travelCost:Number(r.travel_cost||0),otherCost:Number(r.other_cost||0),expectedProductCount:Number(r.expected_product_count||0),
      purchaseCurrency:r.purchase_currency||"KRW",purchaseAmountLocal:Number(r.purchase_amount_local||0),fxRate:Number(r.fx_rate||0)
    })));
    if(!s.error)setSales((s.data||[]).map((r:any)=>({
      id:String(r.sale_id),productId:r.product_id,channel:r.platform,date:r.sold_at,gross:Number(r.gross_amount||0),
      discount:Number(r.discount_amount||0),fee:Number(r.platform_fee||0),paymentFee:Number(r.payment_fee||0),
      shipping:Number(r.shipping_cost||0),other:Number(r.other_cost||0),net:Number(r.expected_settlement||0),
      settled:r.settled_amount==null?undefined:Number(r.settled_amount),status:r.settlement_status,
      paymentMethod:r.payment_method||"",note:r.note||""
    })));
    if(!e.error)setExpenses((e.data||[]).map((r:any)=>({
      id:String(r.expense_id),date:r.expense_date,category:r.category,amount:Number(r.amount||0),batch:r.batch_id||"",
      allocationMethod:r.allocation_method||"",accountingCost:!!r.accounting_cost,managementCost:!!r.management_cost,note:r.note||""
    })));
    if(!ev.error)setEvents((ev.data||[]).map((r:any)=>({
      id:String(r.event_id),entityType:r.entity_type,entityId:r.entity_id,fromStatus:r.from_status||"",
      toStatus:r.to_status,note:r.note||"",actor:r.actor_email||"",createdAt:r.created_at
    })));
    if(!img.error) await hydrateImageRows(img.data||[]);
    if(!pa.error)setPlatformAccounts((pa.data||[]).map((r:any)=>({
      platform:r.platform,storeName:r.store_name||"",loginId:r.login_id||"",profileCode:r.profile_code||"",joinedAt:r.joined_at||"",
      verified:!!r.verified,active:!!r.active,priority:Number(r.priority||50),metrics:r.metrics||{},note:r.note||""
    })));
    if(!pi.error)setPurchaseInbox((pi.data||[]).map((r:any)=>({
      id:String(r.item_id),externalId:r.external_id,sourceSystem:r.source_system,purchaseMethod:r.purchase_method,status:r.status as PurchaseInboxStatus,
      purchaseAt:r.purchase_at||"",brand:r.brand||"",category:r.category||"기타",name:r.product_name,auction:r.auction_no||"",seller:r.seller_name||"",
      pureJpy:Number(r.pure_item_price_jpy||0),firstPaymentKrw:Number(r.first_payment_krw||0),weightG:Number(r.local_weight_g||0),
      localShippingDate:r.local_shipping_date||"",warehouseArrivedAt:r.warehouse_arrived_at||"",sourceNote:r.source_note||"",dataQuality:r.data_quality||"manual",
      batchId:r.batch_id||"",productId:r.product_id||"",convertedAt:r.converted_at||"",createdAt:r.created_at,updatedAt:r.updated_at
    })));
    setLoading(false);
  }

  async function hydrateLegacyImages(rows:Product[]){
    const entries=await Promise.all(rows.filter(p=>p.imagePath).map(async p=>{
      const {data}=await supabase.storage.from("product-images").createSignedUrl(p.imagePath!,3600);
      return [p.id,data?.signedUrl||""] as const;
    }));
    setImageUrls(Object.fromEntries(entries));
  }

  async function hydrateImageRows(rows:any[]){
    if(!rows.length){setProductImages({});setImageUrls({});return;}
    const paths=rows.map(r=>r.storage_path);
    const {data:signed}=await supabase.storage.from("product-images").createSignedUrls(paths,3600);
    const signedMap:Record<string,string>={};
    (signed||[]).forEach((x:any)=>{if(x?.path)signedMap[x.path]=x.signedUrl||""});
    const grouped:Record<string,ProductImage[]>={};
    rows.forEach((r:any)=>{
      const item:ProductImage={id:String(r.image_id),productId:r.product_id,path:r.storage_path,originalName:r.original_name||"",mimeType:r.mime_type||"",
        sizeBytes:r.size_bytes==null?undefined:Number(r.size_bytes),sortOrder:Number(r.sort_order||0),isPrimary:!!r.is_primary,createdAt:r.created_at,signedUrl:signedMap[r.storage_path]||""};
      (grouped[item.productId] ||= []).push(item);
    });
    Object.values(grouped).forEach(list=>list.sort((a,b)=>Number(b.isPrimary)-Number(a.isPrimary)||a.sortOrder-b.sortOrder||Number(a.id)-Number(b.id)));
    setProductImages(grouped);
    const primary:Record<string,string>={};
    Object.entries(grouped).forEach(([pid,list])=>{const first=list.find(x=>x.isPrimary)||list[0];if(first?.signedUrl)primary[pid]=first.signedUrl});
    setImageUrls(primary);
  }

  function directCost(p:Product){
    const payment=((p.firstPayment||0)+(p.secondPayment||0));
    const acquisition=payment>0?payment:p.cost;
    return acquisition+(p.importDuty||0)+(p.importVat||0)+(p.customsFee||0)+(p.otherImportCost||0);
  }

  async function updateBatchStatus(batchId:string,status:BatchStatus){
    const {error}=await supabase.from("batches").update({status}).eq("batch_id",batchId);
    if(error){alert(`배치 상태 변경 실패: ${error.message}`);return;}
    await loadAll();
  }
  async function updateProductStatus(productId:string,status:ProductStatus){
    const {error}=await supabase.from("products").update({inventory_status:status}).eq("product_id",productId);
    if(error){alert(`상품 상태 변경 실패: ${error.message}`);return;}
    await loadAll();
  }

  async function saveBatch(fd:FormData){
    const id=String(fd.get("id"));
    const patch={
      status:String(fd.get("status")),
      carrier:String(fd.get("carrier")||"EMS"),domestic_tracking_no:String(fd.get("domesticTracking")||"")||null,
      international_shipping:nval(fd.get("internationalShipping")),service_fee:nval(fd.get("serviceFee")),storage_fee:nval(fd.get("storageFee")),
      customs_duty:nval(fd.get("customsDuty")),import_vat:nval(fd.get("importVat")),clearance_fee:nval(fd.get("clearanceFee")),
      domestic_shipping:nval(fd.get("domesticShipping")),travel_cost:nval(fd.get("travelCost")),other_cost:nval(fd.get("otherCost")),
      expected_product_count:nval(fd.get("expectedProductCount")),purchase_currency:String(fd.get("purchaseCurrency")||"KRW"),
      purchase_amount_local:nval(fd.get("purchaseAmountLocal")),fx_rate:nval(fd.get("fxRate")),note:String(fd.get("note")||"")||null
    };
    const {error}=await supabase.from("batches").update(patch).eq("batch_id",id);
    if(error){alert(`배치 저장 실패: ${error.message}`);return;}
    setModal(null); await loadAll();
  }

  async function createBatch(fd:FormData){
    const type=String(fd.get("purchaseType")||"국내현금매입");
    const date=String(fd.get("date")||new Date().toISOString().slice(0,10));
    const ym=date.slice(2,7).replace("-","");
    const prefix=type.includes("경매")?"JP-AUC":type.includes("일본")?"JP-DIR":type.includes("국내")?"KR-CASH":"BATCH";
    const same=batches.filter(b=>b.id.startsWith(`${prefix}-${ym}`)).length;
    const id=`${prefix}-${ym}-${String(same+1).padStart(2,"0")}`;
    const row={batch_id:id,purchase_type:type,batch_date:date,source:String(fd.get("source")||""),bundle_no:String(fd.get("bundle")||"")||null,
      tracking_no:String(fd.get("ems")||"")||null,status:String(fd.get("status")||"매입중"),expected_product_count:nval(fd.get("expectedProductCount")),
      purchase_currency:String(fd.get("purchaseCurrency")|| (type.includes("일본")?"JPY":"KRW")),purchase_amount_local:nval(fd.get("purchaseAmountLocal")),
      fx_rate:nval(fd.get("fxRate")),note:String(fd.get("note")||"")||null};
    const {error}=await supabase.from("batches").insert(row);
    if(error){alert(`배치 생성 실패: ${error.message}`);return;}
    setModal(null); await loadAll();
  }

  async function saveProduct(fd:FormData){
    const id=String(fd.get("id"));
    const first=nval(fd.get("firstPayment")),second=nval(fd.get("secondPayment")),duty=nval(fd.get("importDuty")),
      vat=nval(fd.get("importVat")),cf=nval(fd.get("customsFee")),other=nval(fd.get("otherImportCost")),common=nval(fd.get("commonCost")),
      verified=nval(fd.get("verifiedCost"));
    const payment=first+second;
    const acquisition=payment>0?payment:verified;
    const totalCost=acquisition+duty+vat+cf+other+common;
    const nextBatchId=String(fd.get("batch")||"");
    const nextBatch=batches.find(b=>b.id===nextBatchId);
    const patch={
      batch_id:nextBatchId||null,logistics_status:nextBatch?.status||(products.find(p=>p.id===id)?.logisticsStatus||"입고완료"),purchase_date:String(fd.get("date")),purchase_type:String(fd.get("purchaseType")),
      brand:String(fd.get("brand")),category:String(fd.get("category")),product_name:String(fd.get("name")),size:String(fd.get("size")||"")||null,
      color:String(fd.get("color")||"")||null,material:String(fd.get("material")||"")||null,grade:String(fd.get("grade")||"")||null,
      inventory_status:String(fd.get("status")),location:String(fd.get("location")||"")||null,source:String(fd.get("source")||"")||null,
      auction_no:String(fd.get("auction")||"")||null,verified_cost:verified,first_payment:first||null,second_payment:second||null,
      import_duty:duty||null,import_vat:vat||null,customs_fee:cf||null,other_import_cost:other||null,
      allocated_common_cost:common,total_cost:totalCost,expected_price:nval(fd.get("expectedPrice"))||null,note:String(fd.get("note")||"")||null
    };
    const {error}=await supabase.from("products").update(patch).eq("product_id",id);
    if(error){alert(`상품 저장 실패: ${error.message}`);return;}
    setModal(null); await loadAll();
  }

  function nextProductId(){
    const ym=new Date().toISOString().slice(2,7).replace("-","");
    const max=products.map(p=>Number(p.id.split("-").pop())||0).reduce((a,b)=>Math.max(a,b),0);
    return `SME-${ym}-${String(max+1).padStart(4,"0")}`;
  }
  async function createProduct(fd:FormData){
    const id=nextProductId(), batchId=String(fd.get("batch")||""), selected=batches.find(b=>b.id===batchId);
    const type=String(fd.get("purchaseType")||selected?.purchaseType||"국내현금매입");
    const cost=nval(fd.get("verifiedCost"));
    const row={product_id:id,batch_id:batchId||null,purchase_date:String(fd.get("date")||new Date().toISOString().slice(0,10)),
      purchase_type:type,brand:String(fd.get("brand")||""),category:String(fd.get("category")||"기타"),product_name:String(fd.get("name")||""),
      size:String(fd.get("size")||"")||null,color:String(fd.get("color")||"")||null,
      logistics_status:selected?.status || (type.includes("일본")?"매입완료":"입고완료"),inventory_status:(selected?.status && selected.status!=="입고완료")?"입고전":"입고완료",source:String(fd.get("source")||selected?.source||"")||null,
      verified_cost:cost,second_payment:type.includes("경매")?cost:null,total_cost:cost,note:String(fd.get("note")||"WEB 등록")};
    const {error}=await supabase.from("products").insert(row);
    if(error){alert(`상품 생성 실패: ${error.message}`);return;}
    const files=Array.from(quickFile.current?.files||[]);
    if(files.length)await uploadPhotos(id,files,false);
    setModal(null); await loadAll();
  }

  async function uploadPhotos(productId:string,files:File[],reload=true){
    const existing=productImages[productId]?.length||0;
    const room=Math.max(0,10-existing);
    const selected=files.slice(0,room);
    if(!room){alert("상품당 사진은 최대 10장입니다.");return;}
    if(files.length>room)alert(`최대 10장까지 등록됩니다. 선택한 ${files.length}장 중 ${room}장만 업로드합니다.`);
    setUploadingId(productId);
    for(let i=0;i<selected.length;i++){
      const file=selected[i];
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${productId}/${Date.now()}-${i}.${ext}`;
      const {error:storageError}=await supabase.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type||undefined});
      if(storageError){alert(`사진 업로드 실패: ${storageError.message}`);continue;}
      const {error:dbError}=await supabase.from("product_images").insert({product_id:productId,storage_path:path,original_name:file.name,mime_type:file.type||null,size_bytes:file.size,sort_order:existing+i,is_primary:existing===0&&i===0});
      if(dbError){await supabase.storage.from("product-images").remove([path]);alert(`사진 DB 연결 실패: ${dbError.message}`);}
    }
    setUploadingId(null);
    if(reload)await loadAll();
  }

  async function setPrimaryImage(image:ProductImage){
    const {error}=await supabase.from("product_images").update({is_primary:true}).eq("image_id",Number(image.id));
    if(error){alert(`대표사진 변경 실패: ${error.message}`);return;}
    await loadAll();
  }

  async function deleteProductImage(image:ProductImage){
    if(!confirm("이 사진을 삭제할까요?"))return;
    const wasPrimary=image.isPrimary;
    const {error}=await supabase.from("product_images").delete().eq("image_id",Number(image.id));
    if(error){alert(`사진 삭제 실패: ${error.message}`);return;}
    await supabase.storage.from("product-images").remove([image.path]);
    if(wasPrimary){
      const {data:next}=await supabase.from("product_images").select("image_id").eq("product_id",image.productId).order("sort_order",{ascending:true}).order("image_id",{ascending:true}).limit(1).maybeSingle();
      if(next?.image_id)await supabase.from("product_images").update({is_primary:true}).eq("image_id",next.image_id);
    }
    await loadAll();
  }

  async function savePlatformAccount(fd:FormData){
    const platform=String(fd.get("platform"));
    const patch={store_name:String(fd.get("storeName")||"")||null,login_id:String(fd.get("loginId")||"")||null,profile_code:String(fd.get("profileCode")||"")||null,
      joined_at:String(fd.get("joinedAt")||"")||null,verified:fd.get("verified")==="on",active:fd.get("active")==="on",priority:nval(fd.get("priority"))||50,
      note:String(fd.get("note")||"")||null,updated_at:new Date().toISOString()};
    const {error}=await supabase.from("platform_accounts").update(patch).eq("platform",platform);
    if(error){alert(`플랫폼 계정 저장 실패: ${error.message}`);return;}
    setModal(null);await loadAll();
  }

  async function createListing(fd:FormData){
    const row={product_id:String(fd.get("productId")),platform:String(fd.get("platform")),listing_price:nval(fd.get("price")),
      status:String(fd.get("status")||"판매중"),url:String(fd.get("url")||"")||null};
    const {error}=await supabase.from("listings").insert(row);
    if(error){alert(`플랫폼 등록 실패: ${error.message}`);return;}
    setModal(null);await loadAll();
  }
  async function setListingStatus(id:string,status:string){
    const {error}=await supabase.from("listings").update({status,updated_at:new Date().toISOString()}).eq("listing_id",Number(id));
    if(error){alert(`플랫폼 상태 변경 실패: ${error.message}`);return;} await loadAll();
  }
  async function deleteListing(id:string){
    if(!confirm("이 플랫폼 등록 기록을 삭제할까요?"))return;
    const {error}=await supabase.from("listings").delete().eq("listing_id",Number(id));
    if(error){alert(error.message);return;} await loadAll();
  }

  async function createSale(fd:FormData){
    const gross=nval(fd.get("gross")),discount=nval(fd.get("discount")),fee=nval(fd.get("fee")),pay=nval(fd.get("paymentFee")),
      shipping=nval(fd.get("shipping")),other=nval(fd.get("other")),expected=Math.max(0,gross-discount-fee-pay-shipping-other);
    const status=String(fd.get("settlementStatus")||"정산대기");
    const row={product_id:String(fd.get("productId")),platform:String(fd.get("channel")),sold_at:String(fd.get("date")||new Date().toISOString().slice(0,10)),
      gross_amount:gross,discount_amount:discount,platform_fee:fee,payment_fee:pay,shipping_cost:shipping,other_cost:other,
      expected_settlement:expected,settled_amount:status==="정산완료"?expected:null,settlement_status:status,
      payment_method:String(fd.get("paymentMethod")||"")||null,note:String(fd.get("note")||"")||null};
    const {error}=await supabase.from("sales").insert(row);
    if(error){alert(`판매 입력 실패: ${error.message}`);return;}
    setModal(null);await loadAll();
  }
  async function settleSale(s:Sale){
    const amount=prompt("실제 입금된 정산금액을 입력하세요.",String(s.net));
    if(amount===null)return;
    const {error}=await supabase.from("sales").update({settled_amount:Number(amount||0),settlement_status:"정산완료",updated_at:new Date().toISOString()}).eq("sale_id",Number(s.id));
    if(error){alert(error.message);return;} await loadAll();
  }

  async function createExpense(fd:FormData){
    const row={expense_date:String(fd.get("date")||new Date().toISOString().slice(0,10)),category:String(fd.get("category")),
      amount:nval(fd.get("amount")),batch_id:String(fd.get("batch")||"")||null,allocation_method:String(fd.get("allocationMethod")||"")||null,
      accounting_cost:fd.get("accountingCost")==="on",management_cost:fd.get("managementCost")==="on",
      note:String(fd.get("note")||"")||null};
    const {error}=await supabase.from("expenses").insert(row);
    if(error){alert(`비용 등록 실패: ${error.message}`);return;} setModal(null);await loadAll();
  }
  async function deleteExpense(id:string){
    if(!confirm("비용 기록을 삭제할까요?"))return;
    const {error}=await supabase.from("expenses").delete().eq("expense_id",Number(id));if(error){alert(error.message);return;}await loadAll();
  }

  async function allocateBatchCost(batch:Batch,method:"equal"|"cost"){
    const rows=products.filter(p=>p.batch===batch.id);
    if(!rows.length){alert("이 배치에 상품이 없습니다.");return;}
    const expenseTotal=expenses.filter(e=>e.batch===batch.id&&e.managementCost).reduce((a,b)=>a+b.amount,0);
    const common=batch.customsDuty+batch.importVat+batch.clearanceFee+batch.domesticShipping+batch.travelCost+batch.otherCost+expenseTotal;
    if(common<=0){alert("배부할 공통비가 없습니다. 배치 통관비/국내배송비/출장비 또는 비용을 먼저 입력하세요.");return;}
    const baseTotal=rows.reduce((a,b)=>a+Math.max(0,b.cost),0);
    const updates=rows.map((p,i)=>{
      let share=method==="equal"?Math.round(common/rows.length):(baseTotal>0?Math.round(common*(p.cost/baseTotal)):Math.round(common/rows.length));
      if(i===rows.length-1){
        const prior=rows.slice(0,-1).reduce((sum,x)=>sum+(method==="equal"?Math.round(common/rows.length):(baseTotal>0?Math.round(common*(x.cost/baseTotal)):Math.round(common/rows.length))),0);
        share=common-prior;
      }
      return supabase.from("products").update({allocated_common_cost:share,total_cost:directCost(p)+share}).eq("product_id",p.id);
    });
    const res=await Promise.all(updates);
    const err=res.find(x=>x.error)?.error;
    if(err){alert(`배부 실패: ${err.message}`);return;}
    alert(`${batch.id} 공통비 ${won(common)}를 ${method==="equal"?"균등":"원가비례"} 배부했습니다.`);
    await loadAll();
  }

  async function createPurchaseInbox(fd:FormData){
    const row={
      source_system:"merujg",external_id:String(fd.get("externalId")||"").trim(),purchase_method:String(fd.get("purchaseMethod")||"일본경매직구"),
      status:String(fd.get("status")||"구매확정"),purchase_at:String(fd.get("purchaseAt")||"")||null,brand:String(fd.get("brand")||"")||null,
      category:String(fd.get("category")||"기타"),product_name:String(fd.get("name")||"").trim(),auction_no:String(fd.get("auction")||"")||null,
      seller_name:String(fd.get("seller")||"")||null,pure_item_price_jpy:nval(fd.get("pureJpy")),first_payment_krw:nval(fd.get("firstPaymentKrw")),
      local_weight_g:nval(fd.get("weightG")),local_shipping_date:String(fd.get("localShippingDate")||"")||null,
      source_note:String(fd.get("sourceNote")||"")||null,data_quality:"manual"
    };
    if(!row.external_id||!row.product_name){alert("고유번호와 상품명은 필수입니다.");return;}
    const {error}=await supabase.from("purchase_inbox").insert(row);
    if(error){alert(`구매대기 등록 실패: ${error.message}`);return;}
    setModal(null);await loadAll();
  }

  async function savePurchaseInbox(fd:FormData){
    const id=Number(fd.get("id"));
    const patch={
      external_id:String(fd.get("externalId")||"").trim(),purchase_method:String(fd.get("purchaseMethod")||"일본경매직구"),status:String(fd.get("status")),
      purchase_at:String(fd.get("purchaseAt")||"")||null,brand:String(fd.get("brand")||"")||null,category:String(fd.get("category")||"기타"),
      product_name:String(fd.get("name")||"").trim(),auction_no:String(fd.get("auction")||"")||null,seller_name:String(fd.get("seller")||"")||null,
      pure_item_price_jpy:nval(fd.get("pureJpy")),first_payment_krw:nval(fd.get("firstPaymentKrw")),local_weight_g:nval(fd.get("weightG")),
      local_shipping_date:String(fd.get("localShippingDate")||"")||null,source_note:String(fd.get("sourceNote")||"")||null
    };
    const {error}=await supabase.from("purchase_inbox").update(patch).eq("item_id",id);
    if(error){alert(`구매대기 저장 실패: ${error.message}`);return;}
    setModal(null);await loadAll();
  }

  async function updatePurchaseInboxStatus(id:string,status:PurchaseInboxStatus){
    const {error}=await supabase.from("purchase_inbox").update({status}).eq("item_id",Number(id));
    if(error){alert(`상태 변경 실패: ${error.message}`);return;}await loadAll();
  }

  async function deletePurchaseInbox(id:string){
    if(!confirm("이 구매대기 기록을 삭제할까요? 실제 상품으로 전환된 기록은 삭제하지 않는 것을 권장합니다."))return;
    const item=purchaseInbox.find(x=>x.id===id);
    if(item?.convertedAt){alert("이미 배치/상품으로 전환된 기록은 삭제할 수 없습니다.");return;}
    const {error}=await supabase.from("purchase_inbox").delete().eq("item_id",Number(id));
    if(error){alert(error.message);return;}await loadAll();
  }

  async function importPurchaseInbox(fd:FormData){
    const text=String(fd.get("rawText")||"").trim();
    const requested=String(fd.get("status")||"1차결제완료") as PurchaseInboxStatus;
    if(!text){alert("붙여넣을 원문 또는 TSV 데이터가 없습니다.");return;}
    const rows=parsePurchaseImport(text,requested);
    if(!rows.length){alert("고유번호를 찾지 못했습니다. 원문에 ‘고유번호’가 포함되어 있는지 확인하거나 TSV 형식을 사용하세요.");return;}
    const {error}=await supabase.from("purchase_inbox").upsert(rows,{onConflict:"source_system,external_id",ignoreDuplicates:false});
    if(error){alert(`일괄 가져오기 실패: ${error.message}`);return;}
    alert(`${rows.length}건을 구매대기함에 반영했습니다.`);setModal(null);await loadAll();
  }

  async function createBatchFromInbox(fd:FormData){
    const ids=String(fd.get("ids")||"").split(",").map(x=>Number(x)).filter(Boolean);
    const batchId=String(fd.get("batchId")||"").trim();
    const date=String(fd.get("date")||new Date().toISOString().slice(0,10));
    if(!ids.length||!batchId){alert("선택상품과 배치ID를 확인하세요.");return;}
    const {data,error}=await supabase.rpc("create_batch_from_purchase_inbox",{
      p_item_ids:ids,p_batch_id:batchId,p_batch_date:date,p_tracking_no:String(fd.get("tracking")||"")||null,
      p_carrier:String(fd.get("carrier")||"EMS"),p_bundle_no:String(fd.get("bundle")||"")||null,p_note:String(fd.get("note")||"")||null
    });
    if(error){alert(`묶음배송 배치 생성 실패: ${error.message}`);return;}
    void data;
    alert(`${batchId} 배치와 ${ids.length}개 상품을 생성했습니다.`);setModal(null);await loadAll();
  }

  function exportExcel(){
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ["SM EVERFLOW | WEB EXPORT",`v${VERSION}`],["추적 보유자산",trackedAssets],["배치/재고",inventory.length],["일본 구매대기",activeInbox.length],["일본 대기 1차결제",inboxPaid],["통관/배송중",inTransit],
      ["현재 확인 원가",verified],["관리 완전원가",total],["활성 판매등록",activeListings],
      ["누적 판매총액",gross],["실제 정산액",settled],["미정산",pending]
    ]),"01_대시보드");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(products.map(p=>({
      상품ID:p.id,배치ID:p.batch,매입일:p.date,매입유형:p.purchaseType,브랜드:p.brand,품목:p.category,상품명:p.name,사이즈:p.size,
      컬러:p.color,소재:p.material,등급:p.grade,물류상태:p.logisticsStatus,재고판매상태:p.status,위치:p.location,매입처:p.source,경매번호:p.auction,
      확인원가:p.cost,"1차결제":p.firstPayment||"","2차결제":p.secondPayment||"",관세:p.importDuty||"",수입VAT:p.importVat||"",
      통관수수료:p.customsFee||"",기타수입비:p.otherImportCost||"",공통비:p.commonCost,완전원가:p.totalCost,예상판매가:p.expectedPrice||"",
      판매가:p.soldPrice||"",플랫폼:p.platforms.join(", "),대표사진:p.imagePath||"",사진수:(productImages[p.id]||[]).length,비고:p.note||""
    }))),"02_상품마스터");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(batches),"03_배치마스터");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(listings),"07_플랫폼등록");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sales),"08_매출정산");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(expenses),"06_공통비용");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(events),"09_상태이력");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(platformAccounts.map(a=>({플랫폼:a.platform,상점명:a.storeName||"",로그인ID:a.loginId||"",프로필코드:a.profileCode||"",가입일:a.joinedAt||"",인증:a.verified?"Y":"N",활성:a.active?"Y":"N",우선순위:a.priority,메모:a.note||""}))),"10_플랫폼계정");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(purchaseInbox.map(x=>({구매대기ID:x.id,외부고유번호:x.externalId,상태:x.status,매입방식:x.purchaseMethod,브랜드:x.brand||"",품목:x.category,상품명:x.name,경매번호:x.auction||"",순수물품대금JPY:x.pureJpy,일차결제KRW:x.firstPaymentKrw,현지중량g:x.weightG,현지배송일:x.localShippingDate||"",배치ID:x.batchId||"",상품ID:x.productId||"",데이터품질:x.dataQuality,메모:x.sourceNote||""}))),"04_일본구매대기");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(Object.values(productImages).flat().map(i=>({상품ID:i.productId,사진ID:i.id,대표:i.isPrimary?"Y":"N",저장경로:i.path,원본파일:i.originalName||"",정렬:i.sortOrder}))),"11_상품사진");
    XLSX.writeFile(wb,`SM_EVERFLOW_v${VERSION}_${new Date().toISOString().slice(0,10).replaceAll("-","")}.xlsx`);
  }

  if(authLoading)return <AuthShell><div className="mark big">SM</div><h1>SM EVERFLOW</h1><p>인증 상태를 확인하고 있습니다.</p></AuthShell>;
  if(!session)return <div className="authPage"><form className="authCard" onSubmit={login}>
    <div className="authBrand"><div className="mark">SM</div><div><b>EVERFLOW</b><span>PRIVATE OPERATIONS</span></div></div>
    <small>PRIVATE ADMIN · v{VERSION}</small><h1>운영 시스템 로그인</h1><p>허가된 사용자만 접근할 수 있습니다.</p>
    <label>ID<input value={loginId} onChange={e=>setLoginId(e.target.value)} autoComplete="username" placeholder="admin / jedilick / susan98302" /></label>
    <label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
    {loginError&&<div className="authError">{loginError}</div>}<button className="btn dark authSubmit"><ShieldCheck size={17}/>로그인</button>
  </form></div>;

  const editBatch=batches.find(b=>b.id===modal?.id);
  const editProduct=products.find(p=>p.id===modal?.id);
  const editAccount=platformAccounts.find(a=>a.platform===modal?.id);
  const editInbox=purchaseInbox.find(x=>x.id===modal?.id);

  return <div className="shell">
    <aside className={mobile?"open":""}>
      <div className="brand"><div className="mark">SM</div><div><b>EVERFLOW</b><span>PRIVATE OPERATIONS</span></div><button onClick={()=>setMobile(false)}><X size={18}/></button></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={view===id?"active":""} onClick={()=>{setView(id);setMobile(false)}}><Icon size={17}/><span>{label}</span>{id==="inventory"&&<em>{inventory.length}</em>}</button>)}</nav>
      <div className="sideBottom"><div className="mode"><i/><div><b>ONLINE DATABASE</b><span>Supabase · v{VERSION}</span></div></div>
      <button className="sideUser" onClick={logout}><UserRound size={16}/><div><b>{user.name} · {user.role}</b><span>{user.loginId}</span></div><LogOut size={15}/></button></div>
    </aside>
    {mobile&&<div className="shade" onClick={()=>setMobile(false)}/>}
    <main>
      <header><div className="title"><button className="mobileMenu" onClick={()=>setMobile(true)}><Menu size={20}/></button><div><small>SM EVERFLOW / OPERATIONS</small><h1>{nav.find(n=>n[0]===view)?.[1]}</h1></div></div>
      <div className="actions"><button className="btn light" onClick={()=>void loadAll()}><RefreshCw size={16}/></button><button className="btn light" onClick={exportExcel}><Download size={16}/>Excel</button><button className="btn dark" onClick={()=>setModal({type:"product-create"})}><Plus size={16}/>빠른 매입</button></div></header>
      <div className="content">
        {warnings.length>0&&<div className="warningBox"><AlertTriangle size={16}/><div><b>일부 데이터 연결 확인 필요</b>{warnings.map(w=><span key={w}>{w}</span>)}</div></div>}
        {loading&&<div className="loadingBar">데이터를 동기화하고 있습니다...</div>}
        {view==="dashboard"&&<Dashboard products={products} batches={batches} listings={listings} sales={sales} purchaseInbox={purchaseInbox} inventory={inventory} verified={verified} total={total} gross={gross} settled={settled} pending={pending} inTransit={inTransit} activeListings={activeListings} trackedAssets={trackedAssets} awaitingWarehouse={awaitingWarehouse} warehouseReady={warehouseReady} inboxPaid={inboxPaid} events={events} onBatch={(id:string)=>setModal({type:"batch-edit",id})} onPurchases={()=>setView("purchases")}/>}
        {view==="inventory"&&<InventoryView rows={filtered} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} imageUrls={imageUrls} productImages={productImages} uploadingId={uploadingId} onEdit={(id:string)=>setModal({type:"product-edit",id})} onStatus={updateProductStatus}/>}
        {view==="purchases"&&<PurchasesView batches={batches} products={products} expenses={expenses} purchaseInbox={purchaseInbox} onStatus={updateBatchStatus} onEdit={(id:string)=>setModal({type:"batch-edit",id})} onNew={()=>setModal({type:"batch-create"})} onAddProduct={(id:string)=>setModal({type:"product-create",id})} onAllocate={allocateBatchCost} onInboxNew={()=>setModal({type:"inbox-create"})} onInboxImport={()=>setModal({type:"inbox-import"})} onInboxEdit={(id:string)=>setModal({type:"inbox-edit",id})} onInboxStatus={updatePurchaseInboxStatus} onInboxDelete={deletePurchaseInbox} onMakeBatch={(ids:string[])=>setModal({type:"inbox-batch-create",ids})}/>}
        {view==="platforms"&&<PlatformsView listings={listings} products={products} accounts={platformAccounts} onNew={()=>setModal({type:"listing-create"})} onEditAccount={(id:string)=>setModal({type:"platform-account-edit",id})} onStatus={setListingStatus} onDelete={deleteListing}/>}
        {view==="sales"&&<SalesView sales={sales} products={products} onNew={()=>setModal({type:"sale-create"})} onSettle={settleSale}/>}
        {view==="cash"&&<CashView expenses={expenses} batches={batches} sales={sales} onNew={()=>setModal({type:"expense-create"})} onDelete={deleteExpense}/>}
        {view==="settings"&&<SettingsView user={user} products={products} batches={batches} listings={listings} sales={sales} events={events} platformAccounts={platformAccounts} purchaseInbox={purchaseInbox}/>}
      </div>
    </main>

    {modal?.type==="batch-edit"&&editBatch&&<Modal title={`배치 관리 · ${editBatch.id}`} onClose={()=>setModal(null)}><BatchForm batch={editBatch} events={events.filter(e=>e.entityType==="batch"&&e.entityId===editBatch.id)} onSubmit={saveBatch}/></Modal>}
    {modal?.type==="batch-create"&&<Modal title="새 매입·입고 배치" onClose={()=>setModal(null)}><BatchCreateForm onSubmit={createBatch}/></Modal>}
    {modal?.type==="product-edit"&&editProduct&&<Modal title={`상품 관리 · ${editProduct.id}`} onClose={()=>setModal(null)}><ProductForm product={editProduct} batches={batches} images={productImages[editProduct.id]||[]} uploading={uploadingId===editProduct.id} events={events.filter(e=>e.entityType==="product"&&e.entityId===editProduct.id)} onUpload={uploadPhotos} onPrimary={setPrimaryImage} onDeleteImage={deleteProductImage} onSubmit={saveProduct}/></Modal>}
    {modal?.type==="product-create"&&<Modal title={modal.id?`배치 상품 추가 · ${modal.id}`:"빠른 매입 등록"} onClose={()=>setModal(null)}><ProductCreateForm batches={batches} defaultBatch={modal.id||""} fileRef={quickFile} onSubmit={createProduct}/></Modal>}
    {modal?.type==="inbox-create"&&<Modal title="일본 구매대기 · 단건 등록" onClose={()=>setModal(null)}><PurchaseInboxForm onSubmit={createPurchaseInbox}/></Modal>}
    {modal?.type==="inbox-edit"&&editInbox&&<Modal title={`일본 구매대기 · ${editInbox.externalId}`} onClose={()=>setModal(null)}><PurchaseInboxForm item={editInbox} onSubmit={savePurchaseInbox}/></Modal>}
    {modal?.type==="inbox-import"&&<Modal title="대행사이트 원문 · 일괄 가져오기" onClose={()=>setModal(null)}><PurchaseInboxImportForm onSubmit={importPurchaseInbox}/></Modal>}
    {modal?.type==="inbox-batch-create"&&<Modal title="묶음배송 배치 생성" onClose={()=>setModal(null)}><InboxBatchCreateForm items={purchaseInbox.filter(x=>(modal.ids||[]).includes(x.id))} batches={batches} onSubmit={createBatchFromInbox}/></Modal>}
    {modal?.type==="platform-account-edit"&&editAccount&&<Modal title={`${editAccount.platform} 계정 정보`} onClose={()=>setModal(null)}><PlatformAccountForm account={editAccount} onSubmit={savePlatformAccount}/></Modal>}
    {modal?.type==="listing-create"&&<Modal title="플랫폼 등록" onClose={()=>setModal(null)}><ListingForm products={inventory.filter(p=>!["판매완료","반품"].includes(p.status))} onSubmit={createListing}/></Modal>}
    {modal?.type==="sale-create"&&<Modal title="판매·정산 입력" onClose={()=>setModal(null)}><SaleForm products={inventory.filter(p=>!["판매완료","반품"].includes(p.status))} onSubmit={createSale}/></Modal>}
    {modal?.type==="expense-create"&&<Modal title="금전·비용 등록" onClose={()=>setModal(null)}><ExpenseForm batches={batches} onSubmit={createExpense}/></Modal>}
  </div>;
}

function AuthShell({children}:{children:React.ReactNode}){return <div className="authPage"><div className="authCard">{children}</div></div>}

function Dashboard(props:any){
  const {products,batches,purchaseInbox,inventory,verified,total,gross,settled,pending,inTransit,activeListings,trackedAssets,awaitingWarehouse,warehouseReady,inboxPaid,events,onBatch,onPurchases}=props;
  const customs=batches.filter((b:Batch)=>b.status==="통관중");
  const activePurchase=(purchaseInbox as PurchaseInboxItem[]).filter(x=>PURCHASE_INBOX_ACTIVE.has(x.status));
  const statusCount=(status:PurchaseInboxStatus)=>activePurchase.filter(x=>x.status===status).length;
  return <><Intro title="오늘의 운영 현황" copy="일본 현지 구매대기부터 통관·입고·판매·정산까지 회사가 돈을 지출한 자산을 모두 추적합니다."/>
  <div className="kpis wide">
    <Kpi dark label="추적 보유자산" value={`${trackedAssets}점`} note={`배치/상품 ${inventory.length} + 일본대기 ${activePurchase.length}`}/>
    <Kpi label="일본 구매대기" value={`${activePurchase.length}점`} note={`1차결제 누계 ${won(inboxPaid)}`}/>
    <Kpi label="현지 이동중" value={`${awaitingWarehouse}점`} note="구매확정·1차결제·현지배송"/>
    <Kpi label="묶음배송 대기" value={`${warehouseReady}점`} note="현지배송완료·대행창고"/>
    <Kpi label="현재 확인 원가" value={won(verified)} note="배치로 전환된 직접비"/>
    <Kpi label="관리 완전원가" value={won(total)} note="공통비까지 포함"/>
    <Kpi label="누적 판매" value={won(gross)} note={`실제정산 ${won(settled)}`}/>
    <Kpi label="미정산" value={won(pending)} note={`활성 판매등록 ${activeListings}건`}/>
  </div>
  {activePurchase.length>0&&<section className="focusPanel purchaseNow"><div><ShoppingBag size={20}/><div><small>JAPAN PURCHASE NOW</small><h3>한국행 배치 전 일본 보유자산 {activePurchase.length}점</h3><p>낙찰·즉결 구매가 끝난 순간부터 추적합니다. 현지배송완료 상품은 묶음배송 대상 선택 전까지 구매대기함에 남습니다.</p></div></div><div className="purchaseStageChips">{PURCHASE_INBOX_STEPS.map(status=><span key={status} className={statusCount(status)?"hot":""}>{status}<b>{statusCount(status)}</b></span>)}</div><button className="btn dark" onClick={onPurchases}>매입·수입에서 관리 <ChevronRight size={15}/></button></section>}
  {customs.length>0&&<section className="focusPanel"><div><Landmark size={20}/><div><small>CUSTOMS NOW</small><h3>현재 {customs.length}개 배치가 통관중입니다.</h3><p>관세청 단계가 끝나면 배치 상태를 ‘통관완료’로 바꾸세요. 연결된 상품 상태도 자동으로 같이 바뀝니다.</p></div></div><div className="focusList">{customs.map((b:Batch)=><button key={b.id} onClick={()=>onBatch(b.id)}><b>{b.id}</b><span>{b.ems}</span><ChevronRight size={15}/></button>)}</div></section>}
  <div className="grid two"><section className="panel"><Head over="INBOUND PIPELINE" title="한국행 입고 파이프라인"/>{batches.map((b:Batch)=><div className="ship" key={b.id}><StatusIcon status={b.status}/><div><b>{b.id}</b><StatusBadge status={b.status}/><small>{b.source} · {b.ems||"운송장 없음"}</small></div><div className="shipValue"><b>{b.count}점</b><span>{won(b.cost)}</span></div></div>)}</section>
  <section className="panel"><Head over="RECENT STATUS" title="최근 상태 변경"/>{events.slice(0,8).map((e:StatusEvent)=><div className="eventRow" key={e.id}><History size={14}/><div><b>{e.entityId}</b><span>{e.fromStatus||"-"} → {e.toStatus}</span></div><small>{fmtDateTime(e.createdAt)}</small></div>)}</section></div>
  <section className="panel tablePanel"><Head over="RECENT INVENTORY" title="최근 상품"/><SimpleProductTable rows={products.slice(0,8)}/></section></>
}

function InventoryView({rows,query,setQuery,statusFilter,setStatusFilter,imageUrls,productImages,uploadingId,onEdit,onStatus}:any){
 return <><Intro title="상품 하나를 끝까지 추적합니다." copy="행을 한 번 누르면 바로 상품 수정 화면이 열립니다. 대표사진 1장은 재고 썸네일로, 최대 10장은 검수·판매자료로 보관합니다."/>
 <div className="toolbar"><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="상품ID, 브랜드, 상품명, 배치 검색"/></div>
 <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>전체</option>{PRODUCT_STATUSES.map(s=><option key={s}>{s}</option>)}</select><span>{rows.length}개 상품</span></div>
 <section className="panel tablePanel inventoryTable"><div className="tableWrap"><table><thead><tr><th>상품</th><th>물류</th><th>판매상태</th><th>배치</th><th>확인원가</th><th>완전원가</th><th>플랫폼</th><th>사진</th><th>관리</th></tr></thead><tbody>
 {rows.map((p:Product)=><tr key={p.id} className="editableRow" onClick={()=>onEdit(p.id)}><td><div className="prod"><div className="thumb">{imageUrls[p.id]?<img src={imageUrls[p.id]} alt={p.name}/>:initials(p.brand)}</div><div><small>{p.id}</small><b>{p.brand}</b><span>{p.name}</span></div></div></td>
 <td><StatusBadge status={p.logisticsStatus}/></td><td onClick={e=>e.stopPropagation()}><select className="statusSelect" value={p.status} onChange={e=>onStatus(p.id,e.target.value)}>{PRODUCT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
 <td><small>{p.batch||"-"}</small></td><td><b>{won(p.cost)}</b></td><td><b>{won(p.totalCost)}</b></td><td><span className="mini">{p.platforms.length?p.platforms.join(", "):"미등록"}</span></td>
 <td><button type="button" className="photoCount" onClick={e=>{e.stopPropagation();onEdit(p.id)}}><Images size={14}/>{(productImages[p.id]||[]).length}/10{uploadingId===p.id&&<i className="busy"/>}</button></td>
 <td><button type="button" className="btn light compact" onClick={e=>{e.stopPropagation();onEdit(p.id)}}><Edit3 size={14}/>수정</button></td></tr>)}</tbody></table></div></section></>
}

function PurchasesView({batches,products,expenses,purchaseInbox,onStatus,onEdit,onNew,onAddProduct,onAllocate,onInboxNew,onInboxImport,onInboxEdit,onInboxStatus,onInboxDelete,onMakeBatch}:any){
 return <><div className="introRow"><Intro title="매입을 두 층으로 관리합니다." copy="일본은 낙찰·즉결 후 구매대기함에서 먼저 추적하고, 묶음배송을 결정하는 순간 배치·상품으로 전환합니다. 국내 시장매입은 기존처럼 배치를 먼저 열고 사무실에서 상품을 붙입니다."/><button className="btn dark" onClick={onNew}><Plus size={16}/>새 매입 배치</button></div>
 <PurchaseInboxPanel items={purchaseInbox} onNew={onInboxNew} onImport={onInboxImport} onEdit={onInboxEdit} onStatus={onInboxStatus} onDelete={onInboxDelete} onMakeBatch={onMakeBatch}/>
 <div className="sectionDivider"><div><small>BATCH OPERATIONS</small><h3>국제배송 · 국내매입 배치</h3><p>묶음배송을 시작한 일본 상품과 국내 시장매입은 이 단계부터 배치로 관리합니다.</p></div></div>
 <div className="batchGrid">{batches.map((b:Batch)=>{
  const idx=BATCH_STEPS.indexOf(b.status); const next=idx>=0&&idx<BATCH_STEPS.length-1?BATCH_STEPS[idx+1]:null;
  const batchExpenses=expenses.filter((e:Expense)=>e.batch===b.id&&e.managementCost).reduce((a:number,x:Expense)=>a+x.amount,0);
  const allocatable=b.customsDuty+b.importVat+b.clearanceFee+b.domesticShipping+b.travelCost+b.otherCost+batchExpenses;
  const progress=b.expectedProductCount>0?Math.min(100,Math.round((b.count/b.expectedProductCount)*100)):0;
  return <section className="panel batchCard" key={b.id}><div className="batchTop"><div><small>{b.id}</small><h3>{b.source}</h3><span className="batchSub">{b.purchaseType} · {b.purchaseCurrency}{b.purchaseAmountLocal>0?` ${new Intl.NumberFormat("ko-KR").format(b.purchaseAmountLocal)}`:""}</span></div><StatusBadge status={b.status}/></div>
  <div className="flow">{BATCH_STEPS.map((st,i)=><div key={st} className={i<=idx?"done":""}><i/>{st}</div>)}</div>
  <div className="stats"><div><span>묶음</span><b>{b.bundle||"-"}</b></div><div><span>{b.carrier||"EMS"}</span><b>{b.ems||"-"}</b></div><div><span>상품</span><b>{b.count}{b.expectedProductCount>0?` / ${b.expectedProductCount}`:""}점</b>{b.expectedProductCount>0&&<small>{progress}% 디지털화</small>}</div><div><span>확인원가</span><b>{won(b.cost)}</b></div></div>
  <div className="batchActions"><button className="btn accent" onClick={()=>onAddProduct(b.id)}><Plus size={15}/>이 배치에 상품 추가</button><select value={b.status} onChange={e=>onStatus(b.id,e.target.value)}>{BATCH_STEPS.map(st=><option key={st}>{st}</option>)}<option>보류</option></select>
  {next&&<button className="btn dark" onClick={()=>onStatus(b.id,next)}><CheckCircle2 size={15}/>{next}로 진행</button>}
  <button className="btn light" onClick={()=>onEdit(b.id)}><Edit3 size={15}/>비용·상세</button></div>
  {allocatable>0&&<div className="allocation"><span>배부 가능 공통비 <b>{won(allocatable)}</b></span><button onClick={()=>onAllocate(b,"equal")}>균등배부</button><button onClick={()=>onAllocate(b,"cost")}>원가비례</button></div>}
  {b.note&&<div className="note">{b.note}</div>}</section>
 })}</div></>
}

function PurchaseInboxPanel({items,onNew,onImport,onEdit,onStatus,onDelete,onMakeBatch}:any){
  const [selected,setSelected]=useState<string[]>([]);
  const [filter,setFilter]=useState<string>("진행중");
  const active=(items as PurchaseInboxItem[]).filter(x=>PURCHASE_INBOX_ACTIVE.has(x.status));
  const rows=(items as PurchaseInboxItem[]).filter(x=>filter==="전체"?true:filter==="진행중"?PURCHASE_INBOX_ACTIVE.has(x.status):x.status===filter);
  const selectable=rows.filter(x=>BUNDLE_READY_STATUSES.has(x.status)&&!x.convertedAt);
  const allChecked=selectable.length>0&&selectable.every(x=>selected.includes(x.id));
  const toggleAll=()=>setSelected(allChecked?selected.filter(id=>!selectable.some(x=>x.id===id)):[...new Set([...selected,...selectable.map(x=>x.id)])]);
  const warehouseReady=active.filter(x=>["현지배송완료","대행창고보관","묶음배송선택","2차결제대기"].includes(x.status)).length;
  const paid=active.reduce((a,b)=>a+b.firstPaymentKrw,0);
  return <section className="panel inboxPanel"><div className="inboxHead"><div><small>JAPAN PURCHASE INBOX</small><h3>일본 구매대기함</h3><p>낙찰·즉결 구매가 끝났지만 아직 국제배송 묶음이 정해지지 않은 자산입니다.</p></div><div className="inboxActions"><button className="btn light" onClick={onImport}><Upload size={15}/>원문·일괄 가져오기</button><button className="btn accent" onClick={onNew}><Plus size={15}/>단건 추가</button></div></div>
  <div className="inboxSummary"><div><span>진행중</span><b>{active.length}점</b></div><div><span>묶음배송 가능</span><b>{warehouseReady}점</b></div><div><span>확인된 1차결제</span><b>{won(paid)}</b></div><div><span>순수물품대금</span><b>{yen(active.reduce((a,b)=>a+b.pureJpy,0))}</b></div></div>
  <div className="inboxToolbar"><label className="checkAll"><input type="checkbox" checked={allChecked} onChange={toggleAll}/> 현재목록 선택</label><select value={filter} onChange={e=>setFilter(e.target.value)}><option>진행중</option><option>전체</option>{PURCHASE_INBOX_STEPS.map(x=><option key={x}>{x}</option>)}<option>배치전환완료</option><option>보류</option><option>취소</option></select><span>{selected.length}개 선택</span><button className="btn dark" disabled={!selected.length} onClick={()=>onMakeBatch(selected)}><PackageCheck size={15}/>묶음배송 배치 만들기</button></div>
  <div className="tableWrap inboxTable"><table><thead><tr><th></th><th>고유번호 · 상품</th><th>현재상태</th><th>순수물품</th><th>1차결제</th><th>현지배송</th><th>전환</th><th></th></tr></thead><tbody>{rows.map((x:PurchaseInboxItem)=><tr key={x.id} className={x.convertedAt?"converted":""}><td><input type="checkbox" disabled={!!x.convertedAt||!BUNDLE_READY_STATUSES.has(x.status)} checked={selected.includes(x.id)} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,x.id])]:selected.filter(id=>id!==x.id))}/></td><td className="clickCell" onClick={()=>onEdit(x.id)}><b>{x.externalId} · {x.brand||"브랜드 미확인"}</b><small className="block">{x.name}</small>{x.auction&&<small className="block mutedText">경매 {x.auction}</small>}</td><td><select className="statusSelect inboxStatus" value={x.status} disabled={!!x.convertedAt} onChange={e=>onStatus(x.id,e.target.value)}>{PURCHASE_INBOX_STEPS.map(st=><option key={st}>{st}</option>)}<option>보류</option><option>취소</option>{x.status==="배치전환완료"&&<option>배치전환완료</option>}</select></td><td><b>{yen(x.pureJpy)}</b></td><td>{won(x.firstPaymentKrw)}</td><td>{x.localShippingDate||"-"}{x.weightG>0&&<small className="block">{x.weightG}g</small>}</td><td>{x.productId?<><b>{x.productId}</b><small className="block">{x.batchId}</small></>:<span className="mini">배치전</span>}</td><td><div className="rowActions"><button className="iconBtn" onClick={()=>onEdit(x.id)}><Edit3 size={14}/></button>{!x.convertedAt&&<button className="iconBtn danger" onClick={()=>onDelete(x.id)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div>
  {rows.length===0&&<Empty icon={<ShoppingBag/>} title="해당 상태의 구매대기 상품이 없습니다." copy="대행사이트 원문을 붙여넣거나 단건으로 등록하세요."/>}</section>
}

function PlatformsView({listings,products,accounts,onNew,onEditAccount,onStatus,onDelete}:any){
 const count=(name:string)=>listings.filter((l:Listing)=>l.platform===name&&l.status==="판매중").length;
 return <><div className="introRow"><Intro title="판매 채널과 계정을 함께 관리합니다." copy="당근·번개장터의 상점 기준정보를 보관하고, 상품별 실제 게시물은 상품ID에 연결합니다."/><button className="btn dark" onClick={onNew}><Plus size={16}/>플랫폼 등록</button></div>
 <div className="accountGrid">{accounts.map((a:PlatformAccount)=><section className={`panel accountCard ${!a.active?"muted":""}`} key={a.platform}><div className="accountHead"><div><small>{a.active?"ACTIVE":"LOW PRIORITY"}</small><h3>{a.platform}</h3></div><button className="iconBtn" onClick={()=>onEditAccount(a.platform)}><Edit3 size={14}/></button></div><b className="storeName">{a.storeName||"상점명 미입력"}</b><div className="accountMeta">{a.loginId&&<span>ID {a.loginId}</span>}{a.profileCode&&<span>{a.profileCode}</span>}{a.verified&&<span><BadgeCheck size={12}/>인증</span>}</div><AccountMetrics account={a}/><small className="accountNote">{a.note||""}</small></section>)}</div>
 <div className="platforms">{["스마트스토어","당근마켓","번개장터","중고나라","필웨이","오프라인도매"].map(x=><section className="panel" key={x}><span>{x}</span><b>{count(x)}</b><small>판매중</small></section>)}</div>
 <section className="panel tablePanel"><div className="tableWrap"><table><thead><tr><th>상품</th><th>플랫폼</th><th>등록가</th><th>상태</th><th>URL</th><th></th></tr></thead><tbody>{listings.map((l:Listing)=>{
  const p=products.find((x:Product)=>x.id===l.productId);return <tr key={l.id}><td><b>{l.productId}</b><small className="block">{p?.brand} · {p?.name}</small></td><td>{l.platform}</td><td>{won(l.price)}</td><td><select value={l.status} onChange={e=>onStatus(l.id,e.target.value)}><option>판매중</option><option>일시중지</option><option>판매종료</option></select></td><td>{l.url?<a href={l.url} target="_blank" rel="noreferrer" className="openLink"><ExternalLink size={13}/>열기</a>:"-"}</td><td><button className="iconBtn danger" onClick={()=>onDelete(l.id)}><Trash2 size={15}/></button></td></tr>})}</tbody></table></div></section></>
}

function AccountMetrics({account}:{account:PlatformAccount}){
 const m=account.metrics||{};
 if(account.platform==="당근마켓")return <div className="metricChips"><span>매너 {m.manner_temp??"-"}℃</span><span>재거래 {m.resale_hope_pct??"-"}%</span><span>응답 {m.response_rate_pct??"-"}%</span><span>판매물품 {m.sales_items??"-"}</span></div>;
 if(account.platform==="번개장터")return <div className="metricChips"><span>평점 {m.rating??"-"}</span><span>팔로워 {m.followers??"-"}</span><span>상품 {m.products??"-"}</span><span>안전결제 {m.safe_pay??"-"}</span></div>;
 return <div className="metricChips"><span>{account.active?"운영중":"저우선 채널"}</span></div>;
}

function SalesView({sales,products,onNew,onSettle}:any){
 return <><div className="introRow"><Intro title="판매가와 실제 입금액을 분리합니다." copy="판매 처리 시 상품은 자동 판매완료, 플랫폼 게시물은 자동 종료됩니다. 정산일에는 실제 입금액만 확정하면 됩니다."/><button className="btn dark" onClick={onNew}><Plus size={16}/>판매 입력</button></div>
 <section className="panel tablePanel"><div className="tableWrap"><table><thead><tr><th>상품</th><th>채널</th><th>판매가</th><th>공제</th><th>예상정산</th><th>실제정산</th><th>상태</th><th></th></tr></thead><tbody>{sales.map((s:Sale)=>{
  const p=products.find((x:Product)=>x.id===s.productId);return <tr key={s.id}><td><b>{s.productId}</b><small className="block">{p?.brand} · {p?.name}</small></td><td>{s.channel}</td><td>{won(s.gross)}</td><td>{won(s.discount+s.fee+s.paymentFee+s.shipping+s.other)}</td><td><b>{won(s.net)}</b></td><td>{s.settled==null?"-":won(s.settled)}</td><td><StatusBadge status={s.status}/></td><td>{s.status!=="정산완료"&&<button className="btn light" onClick={()=>onSettle(s)}>정산확정</button>}</td></tr>})}</tbody></table></div></section>
 {sales.length===0&&<Empty icon={<CircleDollarSign/>} title="아직 판매 데이터가 없습니다." copy="첫 판매부터 실제 정산액까지 기록하면 상품별 손익이 완성됩니다."/>}</>
}

function CashView({expenses,batches,sales,onNew,onDelete}:any){
 const totalExp=expenses.reduce((a:number,b:Expense)=>a+b.amount,0),cashIn=sales.reduce((a:number,b:Sale)=>a+(b.settled||0),0);
 return <><div className="introRow"><Intro title="실제 돈의 흐름과 관리원가를 분리합니다." copy="출장비·숙박·교통·통관 관련 공통비를 배치에 연결해 상품 원가로 배부할 수 있습니다."/><button className="btn dark" onClick={onNew}><Plus size={16}/>비용 등록</button></div>
 <div className="kpis three"><Kpi dark label="등록 비용" value={won(totalExp)} note="금전·공통비 누계"/><Kpi label="정산 입금" value={won(cashIn)} note="실제 입금 누계"/><Kpi label="미정산" value={won(sales.filter((s:Sale)=>s.status!=="정산완료").reduce((a:number,b:Sale)=>a+b.net,0))} note="플랫폼 정산대기"/></div>
 <section className="panel tablePanel"><div className="tableWrap"><table><thead><tr><th>일자</th><th>분류</th><th>배치</th><th>금액</th><th>회계비용</th><th>관리원가</th><th>비고</th><th></th></tr></thead><tbody>{expenses.map((e:Expense)=><tr key={e.id}><td>{e.date}</td><td>{e.category}</td><td>{e.batch||"-"}</td><td><b>{won(e.amount)}</b></td><td>{e.accountingCost?"Y":"-"}</td><td>{e.managementCost?"Y":"-"}</td><td>{e.note||"-"}</td><td><button className="iconBtn danger" onClick={()=>onDelete(e.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></section></>
}

function SettingsView({user,products,batches,listings,sales,events,platformAccounts,purchaseInbox}:any){
 const activeInbox=(purchaseInbox as PurchaseInboxItem[]).filter(x=>PURCHASE_INBOX_ACTIVE.has(x.status));
 return <><Intro title="SM EVERFLOW 운영 상태" copy="현재 버전과 데이터 무결성을 한 눈에 확인합니다."/>
 <div className="settingsGrid"><section className="panel"><Head over="SYSTEM" title={`v${VERSION}`}/><p>인증: Supabase Auth</p><p>DB: PostgreSQL + RLS</p><p>사진: Private Storage</p><p>PWA: iPhone 홈 화면 앱</p></section>
 <section className="panel"><Head over="USER" title={`${user.name} · ${user.role}`}/><p>ID: {user.loginId}</p><p>권한: 현재 운영 사용자 전체 CRUD</p></section>
 <section className="panel"><Head over="DATA" title="데이터 현황"/><p>상품 {products.length} · 배치 {batches.length}</p><p>일본 구매대기 {activeInbox.length} · 누적기록 {purchaseInbox.length}</p><p>플랫폼 {listings.length} · 판매 {sales.length}</p><p>상태이력 {events.length}건 · 플랫폼 계정 {platformAccounts.length}개</p></section></div></>
}

function BatchForm({batch,events,onSubmit}:{batch:Batch;events:StatusEvent[];onSubmit:(fd:FormData)=>void}){
 return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><input type="hidden" name="id" value={batch.id}/>
 <div className="formGrid three"><Field label="현재 상태"><select name="status" defaultValue={batch.status}>{BATCH_STEPS.map(s=><option key={s}>{s}</option>)}<option>보류</option></select></Field>
 <Field label="예상 상품수"><input name="expectedProductCount" type="number" inputMode="numeric" defaultValue={batch.expectedProductCount||""}/></Field><Field label="매입통화"><select name="purchaseCurrency" defaultValue={batch.purchaseCurrency||"KRW"}><option>KRW</option><option>JPY</option><option>USD</option><option>EUR</option></select></Field>
 <Money name="purchaseAmountLocal" label="현지/배치 매입총액" value={batch.purchaseAmountLocal}/><Money name="fxRate" label="적용 환율" value={batch.fxRate}/><Field label="운송사"><input name="carrier" defaultValue={batch.carrier}/></Field><Field label="국내 운송장"><input name="domesticTracking" defaultValue={batch.domesticTracking}/></Field></div>
 <SectionTitle title="배치 공통비" copy="경매 2차결제에 이미 포함된 국제배송료·대행수수료는 중복 입력하지 않도록 확인하세요."/>
 <div className="formGrid three"><Money name="internationalShipping" label="국제배송료" value={batch.internationalShipping}/><Money name="serviceFee" label="대행수수료" value={batch.serviceFee}/><Money name="storageFee" label="보관료" value={batch.storageFee}/><Money name="customsDuty" label="관세" value={batch.customsDuty}/><Money name="importVat" label="수입 VAT" value={batch.importVat}/><Money name="clearanceFee" label="통관수수료" value={batch.clearanceFee}/><Money name="domesticShipping" label="국내배송비" value={batch.domesticShipping}/><Money name="travelCost" label="출장·체재비" value={batch.travelCost}/><Money name="otherCost" label="기타 공통비" value={batch.otherCost}/></div>
 <Field label="메모"><textarea name="note" defaultValue={batch.note}/></Field>
 <SectionTitle title="상태 이력" copy="배치 상태 변경은 연결된 상품의 물류상태에 자동 반영됩니다."/><Timeline events={events}/>
 <ModalActions/></form>
}

function BatchCreateForm({onSubmit}:{onSubmit:(fd:FormData)=>void}){
 return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><div className="callout"><b>배치부터 먼저 만드세요.</b><span>현장에서 상품을 하나씩 입력하지 않아도 됩니다. 예상 상품수·총액만 먼저 적고 상태를 ‘매입중’으로 열어두면 됩니다.</span></div><div className="formGrid two"><Field label="매입유형"><select name="purchaseType"><option>일본경매직구</option><option>일본온라인직구</option><option>일본직접매입</option><option>국내현금매입</option></select></Field><Field label="배치일"><input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></Field><Field label="매입처"><input name="source" placeholder="업체명 / 경매대행 / 거래처" required/></Field><Field label="초기상태"><select name="status" defaultValue="매입중">{BATCH_STEPS.map(s=><option key={s}>{s}</option>)}</select></Field><Field label="예상 상품수"><input name="expectedProductCount" type="number" inputMode="numeric" placeholder="예: 70"/></Field><Field label="매입통화"><select name="purchaseCurrency" defaultValue="JPY"><option>JPY</option><option>KRW</option><option>USD</option><option>EUR</option></select></Field><Money name="purchaseAmountLocal" label="현지/배치 매입총액"/><Money name="fxRate" label="적용 환율 (선택)"/><Field label="묶음번호"><input name="bundle"/></Field><Field label="EMS/운송장"><input name="ems"/></Field></div><Field label="메모"><textarea name="note" placeholder="네고, 현장 상황, 결제 방식 등"/></Field><ModalActions/></form>
}

function ProductForm({product,batches,images,uploading,events,onUpload,onPrimary,onDeleteImage,onSubmit}:{product:Product;batches:Batch[];images:ProductImage[];uploading:boolean;events:StatusEvent[];onUpload:(id:string,files:File[])=>void;onPrimary:(image:ProductImage)=>void;onDeleteImage:(image:ProductImage)=>void;onSubmit:(fd:FormData)=>void}){
 return <div><ProductGalleryManager product={product} images={images} uploading={uploading} onUpload={onUpload} onPrimary={onPrimary} onDelete={onDeleteImage}/><form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><input type="hidden" name="id" value={product.id}/>
 <SectionTitle title="상품 기본정보" copy="상품 행을 클릭하면 언제든 이 화면에서 수정할 수 있습니다."/><div className="formGrid three"><Field label="배치"><select name="batch" defaultValue={product.batch}><option value="">배치 없음</option>{batches.map(b=><option key={b.id}>{b.id}</option>)}</select></Field><Field label="매입일"><input name="date" type="date" defaultValue={product.date}/></Field><Field label="매입유형"><input name="purchaseType" defaultValue={product.purchaseType}/></Field>
 <Field label="브랜드"><input name="brand" defaultValue={product.brand}/></Field><Field label="품목"><input name="category" defaultValue={product.category}/></Field><Field label="상품명"><input name="name" defaultValue={product.name}/></Field>
 <Field label="사이즈"><input name="size" defaultValue={product.size}/></Field><Field label="컬러"><input name="color" defaultValue={product.color}/></Field><Field label="소재"><input name="material" defaultValue={product.material}/></Field><Field label="등급/상태메모"><input name="grade" defaultValue={product.grade}/></Field><Field label="판매·재고 상태"><select name="status" defaultValue={product.status}>{PRODUCT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
 <Field label="위치"><input name="location" defaultValue={product.location} placeholder="3F-A-01 / 창고 / 촬영실"/></Field><Field label="매입처"><input name="source" defaultValue={product.source}/></Field><Field label="경매번호"><input name="auction" defaultValue={product.auction}/></Field></div>
 <div className="linkedStatus"><span>물류 상태</span><StatusBadge status={product.logisticsStatus}/><small>{product.batch?"배치 상태와 자동 연동":"배치 없는 상품"}</small></div><SectionTitle title="원가" copy="1차+2차 결제가 있으면 해당 합계를 기준으로, 아직 없으면 현재 확인원가를 임시 기준으로 사용합니다."/>
 <div className="formGrid three"><Money name="verifiedCost" label="현재 확인원가" value={product.cost}/><Money name="firstPayment" label="1차결제" value={product.firstPayment}/><Money name="secondPayment" label="2차결제" value={product.secondPayment}/><Money name="importDuty" label="관세" value={product.importDuty}/><Money name="importVat" label="수입 VAT" value={product.importVat}/><Money name="customsFee" label="통관수수료" value={product.customsFee}/><Money name="otherImportCost" label="기타 수입비" value={product.otherImportCost}/><Money name="commonCost" label="배부 공통비" value={product.commonCost}/><Money name="expectedPrice" label="예상 판매가" value={product.expectedPrice}/></div>
 <Field label="메모"><textarea name="note" defaultValue={product.note}/></Field><SectionTitle title="상태 이력"/><Timeline events={events}/><ModalActions/></form></div>
}

function ProductGalleryManager({product,images,uploading,onUpload,onPrimary,onDelete}:any){
 const remaining=Math.max(0,10-images.length);
 return <section className="galleryManager"><div className="galleryHead"><div><small>PRODUCT MEDIA</small><h4>상품 사진 {images.length}/10</h4><p>ERP 대표사진은 1장만 사용하고, 나머지는 상태 검수·플랫폼 판매자료로 보관합니다.</p></div><div className="galleryActions"><label className={`btn accent ${remaining===0?"disabled":""}`}><Images size={15}/>앨범에서 추가<input hidden type="file" accept="image/*" multiple disabled={remaining===0||uploading} onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length)void onUpload(product.id,files);e.currentTarget.value=""}}/></label><label className={`btn light ${remaining===0?"disabled":""}`}><Camera size={15}/>바로 촬영<input hidden type="file" accept="image/*" capture="environment" disabled={remaining===0||uploading} onChange={e=>{const f=e.target.files?.[0];if(f)void onUpload(product.id,[f]);e.currentTarget.value=""}}/></label></div></div>
 {uploading&&<div className="uploadNotice">사진을 업로드하고 있습니다...</div>}
 {images.length===0?<div className="galleryEmpty"><Images size={26}/><b>등록된 사진이 없습니다.</b><span>앨범에서 최대 10장을 한 번에 선택할 수 있습니다.</span></div>:<div className="galleryGrid">{images.map((img:ProductImage)=><div className={`galleryItem ${img.isPrimary?"primary":""}`} key={img.id}><img src={img.signedUrl} alt={product.name}/><div className="galleryOverlay">{img.isPrimary?<span><Star size={12} fill="currentColor"/>대표</span>:<button type="button" onClick={()=>onPrimary(img)}><Star size={13}/>대표로</button>}<button type="button" className="danger" onClick={()=>onDelete(img)}><Trash2 size={13}/></button></div></div>)}</div>}
 </section>
}

function ProductCreateForm({batches,defaultBatch,fileRef,onSubmit}:any){
 const selected=batches.find((b:Batch)=>b.id===defaultBatch);
 return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><div className="callout"><b>{defaultBatch?`${defaultBatch} 배치에 상품을 추가합니다.`:"상품 1점을 새로 등록합니다."}</b><span>사진은 없어도 먼저 등록할 수 있고, 앨범에서 최대 10장까지 선택하면 첫 사진이 대표사진으로 자동 지정됩니다.</span></div><Field label="사진 (선택 · 최대 10장)"><input ref={fileRef} type="file" accept="image/*" multiple/></Field>
 <div className="formGrid two"><Field label="배치"><select name="batch" defaultValue={defaultBatch}><option value="">배치 없음 / 국내 단건</option>{batches.map((b:Batch)=><option key={b.id}>{b.id}</option>)}</select></Field><Field label="매입일"><input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></Field><Field label="매입유형"><select name="purchaseType" defaultValue={selected?.purchaseType||"국내현금매입"}><option>국내현금매입</option><option>일본경매직구</option><option>일본온라인직구</option><option>일본직접매입</option></select></Field><Field label="브랜드"><input name="brand" required/></Field><Field label="품목"><input name="category"/></Field><Field label="상품명"><input name="name" required/></Field><Field label="사이즈"><input name="size"/></Field><Field label="컬러"><input name="color"/></Field><Money name="verifiedCost" label="현재 확인 매입비"/><Field label="매입처"><input name="source" defaultValue={selected?.source||""}/></Field></div><Field label="메모"><textarea name="note"/></Field><ModalActions/></form>
}

function PurchaseInboxForm({item,onSubmit}:{item?:PurchaseInboxItem;onSubmit:(fd:FormData)=>void}){
  return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}>{item&&<input type="hidden" name="id" value={item.id}/>}<div className="callout"><b>일본 현지 구매자산</b><span>낙찰·즉결 구매가 끝난 순간부터 묶음배송 전까지 추적합니다. 상품 사진·정밀 검수는 한국 입고 후 보강해도 됩니다.</span></div><div className="formGrid three"><Field label="대행사이트 고유번호"><input name="externalId" defaultValue={item?.externalId||""} required/></Field><Field label="현재 상태"><select name="status" defaultValue={item?.status||"구매확정"}>{PURCHASE_INBOX_STEPS.map(x=><option key={x}>{x}</option>)}<option>보류</option><option>취소</option>{item?.status==="배치전환완료"&&<option>배치전환완료</option>}</select></Field><Field label="매입방식"><select name="purchaseMethod" defaultValue={item?.purchaseMethod||"일본경매직구"}><option>일본경매직구</option><option>일본온라인직구</option><option>일본직접매입</option></select></Field><Field label="브랜드"><input name="brand" defaultValue={item?.brand||""}/></Field><Field label="품목"><input name="category" defaultValue={item?.category||"기타"}/></Field><Field label="경매번호"><input name="auction" defaultValue={item?.auction||""}/></Field><Field label="구매일시"><input name="purchaseAt" type="datetime-local" defaultValue={item?.purchaseAt?item.purchaseAt.slice(0,16):""}/></Field><Field label="현지배송일"><input name="localShippingDate" type="date" defaultValue={item?.localShippingDate||""}/></Field><Field label="중량(g)"><input name="weightG" type="number" inputMode="numeric" defaultValue={item?.weightG||""}/></Field><Money name="pureJpy" label="순수물품대금 JPY" value={item?.pureJpy||0}/><Money name="firstPaymentKrw" label="1차결제 총액 KRW" value={item?.firstPaymentKrw||0}/><Field label="판매자/출품자"><input name="seller" defaultValue={item?.seller||""}/></Field></div><Field label="상품명"><input name="name" defaultValue={item?.name||""} required/></Field><Field label="메모"><textarea name="sourceNote" defaultValue={item?.sourceNote||""}/></Field>{item?.convertedAt&&<div className="warn"><b>배치 전환 완료</b><span>{item.batchId} · {item.productId}</span></div>}<ModalActions/></form>
}

function PurchaseInboxImportForm({onSubmit}:{onSubmit:(fd:FormData)=>void}){
  const [raw,setRaw]=useState("");
  async function pasteClipboard(){try{const t=await navigator.clipboard.readText();setRaw(t)}catch{alert("클립보드 접근이 차단되었습니다. 입력창을 길게 눌러 붙여넣기 하세요.")}}
  return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><div className="callout"><b>대행사이트 원문을 한 번에 가져옵니다.</b><span>페이지 전체 텍스트를 복사하거나 iPhone 사진의 라이브 텍스트를 복사해 붙여넣으세요. ‘고유번호’를 기준으로 여러 상품을 자동 분리합니다. 자동 추출 결과는 구매대기함에서 수정할 수 있습니다.</span></div><div className="formGrid two"><Field label="기본 상태"><select name="status" defaultValue="현지배송완료">{PURCHASE_INBOX_STEPS.map(x=><option key={x}>{x}</option>)}</select></Field><div className="field"><span>빠른 입력</span><button type="button" className="btn light" onClick={()=>void pasteClipboard()}><Upload size={15}/>클립보드에서 붙여넣기</button></div></div><Field label="대행사이트 원문 / TSV"><textarea name="rawText" className="importText" value={raw} onChange={e=>setRaw(e.target.value)} placeholder={'대행사이트의 목록 원문을 그대로 붙여넣으세요.\n\n대안 TSV 형식:\n고유번호[TAB]상태[TAB]브랜드[TAB]상품명[TAB]JPY금액[TAB]1차결제KRW[TAB]경매번호[TAB]현지배송일[TAB]중량g'}/></Field><div className="infoStrip"><b>V0.6 가져오기 원칙</b><span>완벽한 OCR보다 누락 없는 카운팅을 우선합니다. 자동파싱 후 브랜드·상품명·가격은 필요할 때 수정하세요.</span></div><ModalActions/></form>
}

function InboxBatchCreateForm({items,batches,onSubmit}:{items:PurchaseInboxItem[];batches:Batch[];onSubmit:(fd:FormData)=>void}){
  const today=new Date().toISOString().slice(0,10);
  const ym=today.slice(2,7).replace("-","");
  const same=batches.filter(b=>b.id.startsWith(`JP-AUC-${ym}`)).length;
  const suggested=`JP-AUC-${ym}-${String(same+1).padStart(2,"0")}`;
  return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><input type="hidden" name="ids" value={items.map(x=>x.id).join(",")}/><div className="callout"><b>{items.length}개 상품을 하나의 한국행 배치로 전환합니다.</b><span>이 순간 각 구매대기 상품에 SME 상품ID가 자동 부여됩니다. 운송장이 있으면 바로 ‘국제배송중’, 없으면 ‘출고대기’로 생성됩니다.</span></div><div className="selectedInboxList">{items.map(x=><div key={x.id}><b>{x.externalId} · {x.brand||"브랜드 미확인"}</b><span>{x.name}</span><small>{yen(x.pureJpy)} · {won(x.firstPaymentKrw)} · {x.status}</small></div>)}</div><div className="formGrid two"><Field label="배치ID"><input name="batchId" defaultValue={suggested} required/></Field><Field label="배치일"><input name="date" type="date" defaultValue={today}/></Field><Field label="운송사"><select name="carrier" defaultValue="EMS"><option>EMS</option><option>FedEx</option><option>DHL</option><option>해운특송</option><option>기타</option></select></Field><Field label="국제 운송장"><input name="tracking" placeholder="아직 없으면 비워두기"/></Field><Field label="묶음번호"><input name="bundle"/></Field></div><Field label="메모"><textarea name="note" defaultValue={`Purchase Inbox ${items.length}점 묶음배송 전환`}/></Field><ModalActions/></form>
}

function ListingForm({products,onSubmit}:any){return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><Field label="상품"><select name="productId">{products.map((p:Product)=><option key={p.id} value={p.id}>{p.id} · {p.brand} · {p.name}</option>)}</select></Field><div className="formGrid two"><Field label="플랫폼"><select name="platform"><option>스마트스토어</option><option>당근마켓</option><option>번개장터</option><option>중고나라</option><option>필웨이</option><option>오프라인도매</option></select></Field><Money name="price" label="등록가"/><Field label="상태"><select name="status"><option>판매중</option><option>일시중지</option></select></Field><Field label="URL"><input name="url"/></Field></div><ModalActions/></form>}
function PlatformAccountForm({account,onSubmit}:{account:PlatformAccount;onSubmit:(fd:FormData)=>void}){return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><input type="hidden" name="platform" value={account.platform}/><div className="callout"><b>{account.platform} 내부 계정 기준정보</b><span>비밀번호는 ERP에 저장하지 않습니다. 상점명·ID·프로필 코드와 운영 우선순위만 관리합니다.</span></div><div className="formGrid two"><Field label="상점명"><input name="storeName" defaultValue={account.storeName}/></Field><Field label="로그인 ID"><input name="loginId" defaultValue={account.loginId}/></Field><Field label="프로필 코드"><input name="profileCode" defaultValue={account.profileCode}/></Field><Field label="가입일"><input name="joinedAt" type="date" defaultValue={account.joinedAt}/></Field><Field label="우선순위"><input name="priority" type="number" defaultValue={account.priority}/></Field></div><div className="checkRow"><label><input type="checkbox" name="verified" defaultChecked={account.verified}/> 인증 완료</label><label><input type="checkbox" name="active" defaultChecked={account.active}/> 현재 운영</label></div><Field label="메모"><textarea name="note" defaultValue={account.note}/></Field><ModalActions/></form>}

function SaleForm({products,onSubmit}:any){return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><Field label="상품"><select name="productId">{products.map((p:Product)=><option key={p.id} value={p.id}>{p.id} · {p.brand} · {p.name}</option>)}</select></Field><div className="formGrid three"><Field label="판매일"><input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></Field><Field label="채널"><select name="channel"><option>당근마켓</option><option>번개장터</option><option>스마트스토어</option><option>중고나라</option><option>필웨이</option><option>오프라인도매</option></select></Field><Field label="결제수단"><input name="paymentMethod" placeholder="계좌이체 / 카드 / 에스크로"/></Field><Money name="gross" label="판매가"/><Money name="discount" label="할인"/><Money name="fee" label="플랫폼 수수료"/><Money name="paymentFee" label="결제 수수료"/><Money name="shipping" label="판매자 배송비"/><Money name="other" label="기타비용"/><Field label="정산상태"><select name="settlementStatus"><option>정산대기</option><option>정산완료</option></select></Field></div><Field label="메모"><textarea name="note"/></Field><ModalActions/></form>}
function ExpenseForm({batches,onSubmit}:any){return <form onSubmit={e=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget))}}><div className="formGrid two"><Field label="일자"><input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></Field><Field label="분류"><select name="category"><option>항공</option><option>숙박</option><option>교통</option><option>체재비</option><option>통관비</option><option>국내배송</option><option>포장/소모품</option><option>기타</option></select></Field><Money name="amount" label="금액"/><Field label="연결 배치"><select name="batch"><option value="">공통/미지정</option>{batches.map((b:Batch)=><option key={b.id}>{b.id}</option>)}</select></Field><Field label="배부방식"><select name="allocationMethod"><option value="">미정</option><option value="equal">균등</option><option value="cost">원가비례</option></select></Field></div><div className="checkRow"><label><input type="checkbox" name="accountingCost"/> 회계상 비용</label><label><input type="checkbox" name="managementCost" defaultChecked/> 관리원가 포함</label></div><Field label="비고"><textarea name="note"/></Field><ModalActions/></form>}

function Intro({title,copy}:{title:string;copy:string}){return <section className="intro"><small>SM EVERFLOW / OPERATIONS</small><h2>{title}</h2><p>{copy}</p></section>}
function Kpi({label,value,note,dark=false}:{label:string;value:string;note:string;dark?:boolean}){return <section className={dark?"kpi dark":"kpi"}><span>{label}</span><b>{value}</b><small>{note}</small></section>}
function Head({over,title}:{over:string;title:string}){return <div className="panelHead"><small>{over}</small><h3>{title}</h3></div>}
function Empty({icon,title,copy}:{icon:React.ReactNode;title:string;copy:string}){return <section className="panel empty">{icon}<b>{title}</b><span>{copy}</span></section>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modalShade" onMouseDown={onClose}><section className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalHead"><div><small>SM EVERFLOW · v{VERSION}</small><h3>{title}</h3></div><button onClick={onClose}><X size={18}/></button></div>{children}</section></div>}
function ModalActions(){return <div className="modalActions"><button className="btn dark"><Save size={15}/>저장</button></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Money({name,label,value=0}:{name:string;label:string;value?:number}){return <Field label={label}><input name={name} type="number" inputMode="numeric" defaultValue={value||""}/></Field>}
function SectionTitle({title,copy}:{title:string;copy?:string}){return <div className="sectionTitle"><h4>{title}</h4>{copy&&<p>{copy}</p>}</div>}
function Timeline({events}:{events:StatusEvent[]}){return <div className="timeline">{events.length===0?<small>상태 변경 이력이 없습니다.</small>:events.slice(0,12).map(e=><div key={e.id}><i/><div><b>{e.fromStatus||"-"} → {e.toStatus}</b><span>{e.actor||"system"} · {fmtDateTime(e.createdAt)}</span></div></div>)}</div>}
function StatusBadge({status}:{status:string}){return <span className={`statusBadge s-${status.replaceAll(" ","")}`}>{status}</span>}
function StatusIcon({status}:{status:string}){if(status==="통관중"||status==="통관완료")return <div className="shipIcon"><Landmark size={18}/></div>;if(status==="입고완료")return <div className="shipIcon"><PackageCheck size={18}/></div>;if(status==="국제배송중")return <div className="shipIcon"><Plane size={18}/></div>;return <div className="shipIcon"><Truck size={18}/></div>}
function SimpleProductTable({rows}:{rows:Product[]}){return <div className="tableWrap"><table><thead><tr><th>상품</th><th>물류</th><th>판매상태</th><th>배치</th><th>확인원가</th><th>완전원가</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><b>{p.brand}</b><small className="block">{p.id} · {p.name}</small></td><td><StatusBadge status={p.logisticsStatus}/></td><td><StatusBadge status={p.status}/></td><td>{p.batch||"-"}</td><td>{won(p.cost)}</td><td><b>{won(p.totalCost)}</b></td></tr>)}</tbody></table></div>}
function initials(brand:string){return brand.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function fmtDateTime(v?:string){if(!v)return "-";try{return new Intl.DateTimeFormat("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v))}catch{return v}}
