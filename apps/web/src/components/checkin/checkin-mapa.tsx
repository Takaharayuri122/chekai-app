'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface PontoCheckinMapa {
  latitude: number;
  longitude: number;
  titulo: string;
  descricao?: string;
  cor: string;
}

interface CheckinMapaProps {
  pontos: PontoCheckinMapa[];
  altura?: number;
}

function coordsIguais(a: PontoCheckinMapa, b: PontoCheckinMapa): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

export function CheckinMapa({ pontos, altura = 260 }: CheckinMapaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const pontosValidos = useMemo(
    () => pontos.filter((ponto) => Number.isFinite(ponto.latitude) && Number.isFinite(ponto.longitude)),
    [pontos],
  );

  useEffect(() => {
    if (!containerRef.current || pontosValidos.length === 0) {
      return;
    }
    let cancelado = false;
    const iniciar = async (): Promise<void> => {
      const leaflet = await import('leaflet');
      if (cancelado || !containerRef.current) {
        return;
      }
      mapaRef.current?.remove();
      const primeiro = pontosValidos[0];
      const mapa = leaflet.map(containerRef.current, {
        scrollWheelZoom: false,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
      }).setView([primeiro.latitude, primeiro.longitude], 16);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapa);

      const agrupados: PontoCheckinMapa[][] = [];
      pontosValidos.forEach((ponto) => {
        const grupo = agrupados.find((itens) => coordsIguais(itens[0], ponto));
        if (grupo) {
          grupo.push(ponto);
          return;
        }
        agrupados.push([ponto]);
      });

      const marcadores = agrupados.map((grupo) => {
        const ponto = grupo[0];
        const icone = leaflet.divIcon({
          className: '',
          html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${ponto.cor};border:2px solid white;box-shadow:0 0 0 1px ${ponto.cor}"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const popup = grupo
          .map((item) => `<strong>${item.titulo}</strong>${item.descricao ? `<br/>${item.descricao}` : ''}`)
          .join('<br/><br/>');
        return leaflet.marker([ponto.latitude, ponto.longitude], { icon: icone })
          .bindPopup(popup)
          .addTo(mapa);
      });

      if (marcadores.length > 1) {
        const grupo = leaflet.featureGroup(marcadores);
        mapa.fitBounds(grupo.getBounds().pad(0.25));
      }
      mapaRef.current = mapa;
    };
    void iniciar();
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [pontosValidos]);

  if (pontosValidos.length === 0) {
    return (
      <div className="rounded-xl border border-base-300 bg-base-200/40 px-4 py-8 text-center text-sm text-base-content/60">
        Sem coordenadas para exibir no mapa.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative z-0 w-full overflow-hidden rounded-xl border border-base-300"
      style={{ height: altura }}
    />
  );
}
