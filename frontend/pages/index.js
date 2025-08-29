import useSWR from 'swr';
import Head from 'next/head';
import { useState } from 'react';

const fetcher = (url)=> fetch(url).then(r=>r.json());

export default function Home(){
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const token = null; // frontend is public view (no admin login here)
  const { data, error } = useSWR(token ? [apiBase + '/api/prices', token] : null, fetcher);
  // We'll fetch market directly for public display (no auth) via public endpoints
  const { data: market } = useSWR(apiBase + '/api/market', fetcher);

  return (
    <>
      <Head>
        <title>Altın & Döviz Dashboard</title>
      </Head>
      <div className="min-h-screen p-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Altın & Döviz Dashboard</h1>
            <p className="text-sm opacity-80">Gerçek zamanlı fiyatlar ve hesaplama aracı</p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">Tarih: {new Date().toLocaleString()}</div>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <section className="col-span-2 bg-slate-800/50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">Anlık Piyasa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Card title={'GRAM ALTIN'} value={market?.genelpara?.altin?.GA?.satis || '---'} />
              <Card title={'USD'} value={market?.truncgil?.USD?.Satis || market?.truncgil?.USD?.Selling || '---'} />
              <Card title={'EUR'} value={market?.truncgil?.EUR?.Satis || '---'} />
              <Card title={'ONS'} value={market?.truncgil?.Ons?.Satis || '---'} />
            </div>
          </section>

          <aside className="bg-slate-800/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Hesaplama Aracı</h3>
            <Calculator />
          </aside>

          <section className="col-span-3 bg-slate-800/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Fiyat Listesi</h3>
            <PriceTable prices={data?.prices} />
          </section>
        </main>
      </div>
    </>
  );
}

function Card({title,value}){ return (
  <div className="p-4 rounded-lg bg-gradient-to-tr from-slate-700/60 to-slate-800/60 shadow">
    <div className="text-sm opacity-80">{title}</div>
    <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</div>
  </div>
);}

function Calculator(){
  const [gram,setGram] = useState(1);
  const price = 3530; // placeholder, ideally from market API
  return (
    <div>
      <label className="block text-sm mb-1">Gram Altın</label>
      <input type="number" value={gram} onChange={e=>setGram(e.target.value)} className="w-full p-2 rounded bg-slate-700"/>
      <div className="mt-3">TL: <span className="font-semibold">{(gram*price).toLocaleString('tr-TR')}</span></div>
    </div>
  );
}

function PriceTable({prices}){
  if(!prices) return <div className="opacity-70">Fiyat verisi yok (kamu erişimi için backend auth gerektirir)</div>;
  const rows = Object.entries(prices);
  return (
    <table className="w-full">
      <thead><tr className="text-left"><th>Ürün</th><th>Alış</th><th>Satış</th></tr></thead>
      <tbody>
        {rows.map(([k,v])=>(
          <tr key={k} className="border-t border-slate-700">
            <td className="py-2">{k.replaceAll('_',' ').toUpperCase()}</td>
            <td className="py-2">{v.alis}</td>
            <td className="py-2">{v.satis}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
