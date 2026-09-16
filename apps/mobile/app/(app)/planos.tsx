import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import {
  Package,
  Users,
  ClipboardCheck,
  Building2,
  Coins,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowLeft,
  WifiOff,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import {
  consultarLimites,
  consultarCreditos,
  type LimitesGestor,
  type SaldoCreditos,
  type UsoCredito,
} from '../../src/api/gestor.api';

const LIMIT_HISTORICO = 20;

type CorUso = 'success' | 'warning' | 'error';

function calcularPercentual(usado: number, limite: number): number {
  if (!limite || limite <= 0) return 0;
  return Math.min(100, Math.round((usado / limite) * 100));
}

function corPorPercentual(percentual: number): CorUso {
  if (percentual >= 90) return 'error';
  if (percentual >= 70) return 'warning';
  return 'success';
}

const COR_HEX: Record<CorUso, string> = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

function formatarCreditos(valor: number | string): string {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarData(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString('pt-BR');
}

function BarraProgresso({ percentual }: { percentual: number }): JSX.Element {
  const cor = COR_HEX[corPorPercentual(percentual)];
  return (
    <View className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
      <View
        className="h-2 rounded-full"
        style={{ width: `${percentual}%`, backgroundColor: cor }}
      />
    </View>
  );
}

function LinhaUso({
  label,
  usado,
  limite,
}: {
  label: string;
  usado: number;
  limite: number;
}): JSX.Element {
  const percentual = calcularPercentual(usado, limite);
  const cor = COR_HEX[corPorPercentual(percentual)];
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-medium text-neutral text-sm">{label}</Text>
        <Text className="font-sans-medium text-sm" style={{ color: cor }}>
          {formatarNumero(usado)} / {formatarNumero(limite)} ({percentual}%)
        </Text>
      </View>
      <BarraProgresso percentual={percentual} />
    </View>
  );
}

function CartaoSaldo({
  titulo,
  valor,
  Icone,
  cor,
}: {
  titulo: string;
  valor: string;
  Icone: typeof Coins;
  cor: string;
}): JSX.Element {
  return (
    <View className="flex-1 rounded-2xl border border-gray-200 bg-white p-4 gap-2">
      <Icone color={cor} size={20} />
      <Text className="font-sans text-gray-500 text-xs">{titulo}</Text>
      <Text className="font-sans-semibold text-neutral text-lg">{valor}</Text>
    </View>
  );
}

export default function PlanosScreen(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const podeVer = user?.perfil === 'gestor' || user?.perfil === 'master';
  const [online, setOnline] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [limites, setLimites] = useState<LimitesGestor | null>(null);
  const [saldo, setSaldo] = useState<SaldoCreditos | null>(null);
  const [historico, setHistorico] = useState<UsoCredito[]>([]);
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [page, setPage] = useState(1);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return unsubscribe;
  }, []);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [dadosLimites, dadosCreditos] = await Promise.all([
        consultarLimites(),
        consultarCreditos(1, LIMIT_HISTORICO),
      ]);
      setLimites(dadosLimites);
      setSaldo(dadosCreditos.saldo);
      setHistorico(dadosCreditos.historico.items ?? []);
      setTotalHistorico(dadosCreditos.historico.total ?? 0);
      setPage(1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    }
  }, []);

  useEffect(() => {
    if (!podeVer) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    setCarregando(true);
    carregar().finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [podeVer, carregar]);

  const handleRefresh = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  const handleCarregarMais = useCallback(async () => {
    if (carregandoMais) return;
    const proximaPagina = page + 1;
    setCarregandoMais(true);
    try {
      const dados = await consultarCreditos(proximaPagina, LIMIT_HISTORICO);
      setHistorico((atual) => [...atual, ...(dados.historico.items ?? [])]);
      setTotalHistorico(dados.historico.total ?? 0);
      setPage(proximaPagina);
    } catch {
      // Mantém o histórico já carregado em caso de falha pontual de rede.
    } finally {
      setCarregandoMais(false);
    }
  }, [carregandoMais, page]);

  if (!podeVer) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200 px-8">
        <AlertCircle color="#f59e0b" size={40} />
        <Text className="font-sans-semibold text-neutral text-base mt-4 text-center">
          Disponível apenas para gestores
        </Text>
        <Text className="font-sans text-gray-500 text-sm mt-1 text-center">
          Esta área mostra plano, limites e créditos da consultoria.
        </Text>
      </View>
    );
  }

  const temMais = historico.length < totalHistorico;

  return (
    <ScrollView
      className="flex-1 bg-base-200"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor="#00B8A9" />
      }
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white items-center justify-center border border-gray-200"
          hitSlop={8}
        >
          <ArrowLeft color="#1B2A4A" size={20} />
        </Pressable>
        <View>
          <Text className="font-sans-semibold text-neutral text-xl">Plano e créditos</Text>
          <Text className="font-sans text-gray-500 text-sm">Limites, uso e saldo de IA</Text>
        </View>
      </View>

      {!online && (
        <View className="flex-row items-center gap-2 rounded-xl bg-warning/10 border border-warning px-4 py-3">
          <WifiOff color="#f59e0b" size={18} />
          <Text className="font-sans text-neutral text-sm flex-1">
            Você está offline. Os dados podem estar desatualizados.
          </Text>
        </View>
      )}

      {carregando ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#00B8A9" />
        </View>
      ) : erro ? (
        <View className="rounded-2xl border border-gray-200 bg-white p-6 items-center gap-3">
          <AlertCircle color="#ef4444" size={36} />
          <Text className="font-sans-semibold text-neutral text-base text-center">
            Não foi possível carregar
          </Text>
          <Text className="font-sans text-gray-500 text-sm text-center">{erro}</Text>
          <Pressable
            onPress={handleRefresh}
            className="bg-primary rounded-xl px-5 py-3 mt-1"
          >
            <Text className="text-white font-sans-semibold text-sm">Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {limites ? (
            <>
              <View className="rounded-2xl border border-gray-200 bg-white p-4 flex-row items-center gap-3">
                <Package color="#00B8A9" size={24} />
                <View>
                  <Text className="font-sans text-gray-500 text-xs">Plano atual</Text>
                  <Text className="font-sans-semibold text-neutral text-lg">
                    {limites.plano.nome}
                  </Text>
                </View>
              </View>

              <View className="rounded-2xl border border-gray-200 bg-white p-4 gap-4">
                <Text className="font-sans-semibold text-neutral text-base">Uso vs. limites</Text>
                <LinhaUso
                  label="Usuários"
                  usado={limites.uso.usuarios}
                  limite={limites.plano.limiteUsuarios}
                />
                <LinhaUso
                  label="Auditorias"
                  usado={limites.uso.auditorias}
                  limite={limites.plano.limiteAuditorias}
                />
                <LinhaUso
                  label="Clientes"
                  usado={limites.uso.clientes}
                  limite={limites.plano.limiteClientes}
                />
                <LinhaUso
                  label="Créditos de IA"
                  usado={limites.uso.creditos}
                  limite={limites.plano.limiteCreditos}
                />
              </View>
            </>
          ) : (
            <View className="rounded-2xl border border-gray-200 bg-white p-6 items-center gap-2">
              <AlertCircle color="#f59e0b" size={36} />
              <Text className="font-sans-semibold text-neutral text-base">Sem assinatura ativa</Text>
              <Text className="font-sans text-gray-500 text-sm text-center">
                Entre em contato com o administrador para ativar um plano.
              </Text>
            </View>
          )}

          {saldo && (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <CartaoSaldo
                  titulo="Limite total"
                  valor={formatarNumero(saldo.limite)}
                  Icone={Coins}
                  cor="#0891b2"
                />
                <CartaoSaldo
                  titulo="Créditos usados"
                  valor={formatarNumero(saldo.usado)}
                  Icone={TrendingUp}
                  cor={COR_HEX[corPorPercentual(calcularPercentual(saldo.usado, saldo.limite))]}
                />
              </View>
              <CartaoSaldo
                titulo="Créditos disponíveis"
                valor={formatarNumero(saldo.disponivel)}
                Icone={TrendingDown}
                cor={saldo.disponivel <= 0 ? '#ef4444' : '#10b981'}
              />
              <View className="rounded-2xl border border-gray-200 bg-white p-4 gap-3">
                <Text className="font-sans-semibold text-neutral text-base">Consumo de créditos</Text>
                <BarraProgresso percentual={calcularPercentual(saldo.usado, saldo.limite)} />
                <View className="flex-row justify-between">
                  <Text className="font-sans text-gray-400 text-xs">0</Text>
                  <Text className="font-sans text-gray-400 text-xs">
                    {formatarNumero(saldo.limite)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View className="rounded-2xl border border-gray-200 bg-white p-4 gap-3">
            <Text className="font-sans-semibold text-neutral text-base">Histórico de uso</Text>
            {historico.length === 0 ? (
              <Text className="font-sans text-gray-500 text-sm py-4 text-center">
                Nenhum uso registrado ainda.
              </Text>
            ) : (
              <>
                {historico.map((uso) => (
                  <View
                    key={uso.id}
                    className="border-b border-gray-100 pb-3 gap-1"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-sans-medium text-neutral text-sm">
                        {uso.metodoChamado}
                      </Text>
                      <Text className="font-sans-semibold text-neutral text-sm">
                        {formatarCreditos(uso.creditosConsumidos)} cr.
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="font-sans text-gray-500 text-xs">
                        {formatarData(uso.criadoEm)}
                      </Text>
                      <Text className="font-sans text-gray-500 text-xs">
                        {uso.provedor} · {formatarNumero(Number(uso.tokensTotal))} tokens
                      </Text>
                    </View>
                    {uso.usuario?.nome ? (
                      <Text className="font-sans text-gray-400 text-xs">{uso.usuario.nome}</Text>
                    ) : null}
                  </View>
                ))}
                {temMais && (
                  <Pressable
                    onPress={handleCarregarMais}
                    disabled={carregandoMais}
                    className="items-center py-3"
                  >
                    {carregandoMais ? (
                      <ActivityIndicator color="#00B8A9" />
                    ) : (
                      <Text className="text-primary font-sans-semibold text-sm">
                        Carregar mais
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
