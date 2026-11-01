import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Package, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import { CheckinCard } from '../../src/components/checkin/CheckinCard';
import { CheckinOfflineLista } from '../../src/components/checkin/CheckinOfflineLista';
import { AuditoriaRepo, type AuditoriaListItem } from '../../src/db/repositories/auditoria.repo';
import { FilaRepo } from '../../src/db/repositories/fila.repo';
import { listarAgendaAgendada, listarTarefasPlanoAcao, type AgendaItemApi, type TarefaPlanoAcaoApi } from '../../src/api/inicio.api';
import { temInternet } from '../../src/utils/conexao';
import { dataLocalISO, filtrarAgendaDoDia, filtrarEmAndamento, filtrarTarefasAtrasadas } from '../../src/utils/inicio';

// Sem Figma: segue o Início do auditor do web (apps/web/src/components/inicio/inicio-auditor.tsx).

type EstadoOnline = 'carregando' | 'sem_internet' | 'pronto';

const auditoriaRepo = new AuditoriaRepo();
const filaRepo = new FilaRepo();

function dataBr(iso: string | null): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <Text className="font-sans-semibold text-neutral text-base mb-2">{titulo}</Text>
      {children}
    </View>
  );
}

function Linha({ titulo, detalhe, destaque, onPress }: { titulo: string; detalhe: string; destaque?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-center py-2.5 border-t border-gray-100">
      <View className="flex-1 mr-2">
        <Text className="font-sans-medium text-neutral text-sm" numberOfLines={1}>{titulo}</Text>
        <Text className={`font-sans text-xs ${destaque ? 'text-red-600' : 'text-gray-500'}`} numberOfLines={1}>{detalhe}</Text>
      </View>
      {onPress && <ChevronRight color="#9CA3AF" size={18} />}
    </Pressable>
  );
}

function Mensagem({ texto }: { texto: string }) {
  return <Text className="font-sans text-sm text-gray-500 py-2">{texto}</Text>;
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const podeVerPlanos = user?.perfil === 'gestor' || user?.perfil === 'master';
  const [emAndamento, setEmAndamento] = useState<AuditoriaListItem[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [agenda, setAgenda] = useState<AgendaItemApi[]>([]);
  const [tarefas, setTarefas] = useState<TarefaPlanoAcaoApi[]>([]);
  const [estadoOnline, setEstadoOnline] = useState<EstadoOnline>('carregando');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setEmAndamento(filtrarEmAndamento(auditoriaRepo.findAll()));
      setPendentes(user?.id ? filaRepo.contarPendentes(user.id) : 0);
    } catch {
      setEmAndamento([]);
    }
    if (!(await temInternet())) {
      setEstadoOnline('sem_internet');
      return;
    }
    const hoje = dataLocalISO();
    const [g, t] = await Promise.allSettled([listarAgendaAgendada(), listarTarefasPlanoAcao()]);
    setAgenda(g.status === 'fulfilled' ? filtrarAgendaDoDia(g.value, hoje) : []);
    setTarefas(t.status === 'fulfilled' ? filtrarTarefasAtrasadas(t.value, hoje) : []);
    setEstadoOnline('pronto');
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const handleRefresh = async () => {
    setAtualizando(true);
    try {
      await carregar();
    } finally {
      setAtualizando(false);
    }
  };

  const hoje = dataLocalISO();
  const blocoOnline = (lista: React.ReactNode, vazio: string, temItens: boolean) => {
    if (estadoOnline === 'carregando') return <ActivityIndicator color="#00B8A9" className="py-2" />;
    if (estadoOnline === 'sem_internet') return <Mensagem texto="Disponível com internet." />;
    return temItens ? lista : <Mensagem texto={vazio} />;
  };

  return (
    <ScrollView
      className="flex-1 bg-base-200"
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor="#00B8A9" />}
    >
      <View>
        <Text className="font-display text-2xl text-neutral">Olá, {user?.nome?.split(' ')[0] ?? 'auditora'}</Text>
        <Text className="font-sans text-gray-500 text-sm">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/(app)/auditorias/nova')}
        className="h-14 rounded-2xl bg-primary items-center justify-center"
      >
        <Text className="font-sans-semibold text-white text-base">+ Nova auditoria</Text>
      </Pressable>

      <CheckinCard />
      <CheckinOfflineLista />

      {pendentes > 0 && (
        <Pressable
          onPress={() => router.push('/(app)/auditorias')}
          className="flex-row items-center rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <Text className="flex-1 font-sans-medium text-amber-800 text-sm">
            {pendentes === 1 ? '1 envio aguardando internet ou com falha' : `${pendentes} envios aguardando internet ou com falha`}
          </Text>
          <ChevronRight color="#B45309" size={18} />
        </Pressable>
      )}

      <Bloco titulo="Continuar auditoria">
        {emAndamento.length === 0 ? (
          <Mensagem texto="Nenhuma auditoria em andamento." />
        ) : (
          emAndamento.map((a) => (
            <Linha
              key={a.id}
              titulo={a.unidadeNome}
              detalhe={`${a.clienteNome} · iniciada em ${dataBr(a.dataInicio)}`}
              onPress={() => router.push({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: a.id } })}
            />
          ))
        )}
      </Bloco>

      <Bloco titulo="Hoje na agenda">
        {blocoOnline(
          agenda.map((g) => {
            const atrasada = g.dataPrevista.slice(0, 10) < hoje;
            return (
              <Linha
                key={g.id}
                titulo={g.unidade?.nome ?? 'Unidade'}
                detalhe={`${g.template?.nome ?? ''} · ${atrasada ? `atrasada desde ${dataBr(g.dataPrevista)}` : 'hoje'}`}
                destaque={atrasada}
                onPress={() => router.push('/(app)/auditorias/nova')}
              />
            );
          }),
          'Nenhuma visita para hoje.',
          agenda.length > 0,
        )}
      </Bloco>

      <Bloco titulo="Tarefas atrasadas">
        {blocoOnline(
          tarefas.map((t) => <Linha key={t.id} titulo={t.titulo} detalhe={`Prazo ${dataBr(t.prazo)}`} destaque />),
          'Nenhuma tarefa atrasada.',
          tarefas.length > 0,
        )}
      </Bloco>

      {podeVerPlanos && (
        <Pressable
          onPress={() => router.push('/(app)/planos')}
          className="w-full flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
            <Package color="#00B8A9" size={20} />
          </View>
          <View className="flex-1">
            <Text className="font-sans-semibold text-neutral text-base">Plano e créditos</Text>
            <Text className="font-sans text-gray-500 text-sm">Limites, uso e saldo de IA</Text>
          </View>
          <ChevronRight color="#9CA3AF" size={20} />
        </Pressable>
      )}
    </ScrollView>
  );
}
