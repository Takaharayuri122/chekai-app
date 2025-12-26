import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import { TemplateItem, CategoriaItem, CriticidadeItem } from './entities/template-item.entity';
import { TipoAtividade } from '../cliente/entities/cliente.entity';
import {
  ImportarMokiDto,
  MokiCsvRow,
  ImportacaoPreview,
  ImportacaoGrupoPreview,
  ImportacaoResultado,
} from './dto/importar-moki.dto';

/**
 * Serviço responsável pela importação de checklists do Moki.
 */
@Injectable()
export class MokiImportService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private readonly templateRepository: Repository<ChecklistTemplate>,
    @InjectRepository(ChecklistGrupo)
    private readonly grupoRepository: Repository<ChecklistGrupo>,
    @InjectRepository(TemplateItem)
    private readonly itemRepository: Repository<TemplateItem>,
  ) {}

  /**
   * Faz o parse de um arquivo CSV do Moki.
   */
  parseCsv(csvContent: string): MokiCsvRow[] {
    const lines = csvContent.split('\n').map((line) => this.parseCsvLine(line));
    
    // Ignora as primeiras 5 linhas (cabeçalho)
    const dataLines = lines.slice(5).filter((cols) => cols.length > 2 && cols[2]?.trim());

    return dataLines.map((cols) => ({
      grupo: cols[0]?.trim() || '',
      secao: cols[1]?.trim() || '',
      pergunta: cols[2]?.trim() || '',
      tipoResposta: cols[3]?.trim() || undefined,
      pontuacaoMaxima: cols[4] ? parseFloat(cols[4]) : undefined,
      processo: cols[5]?.trim() || undefined,
      tags: cols[6]?.trim() || undefined,
      perguntaAtiva: this.parseBool(cols[7]),
      respostaObrigatoria: this.parseBool(cols[8]),
      justificativaObrigatoria: this.parseBool(cols[9]),
      permiteComentario: this.parseBool(cols[11]),
      permiteFotos: this.parseBool(cols[16]),
      fotosObrigatorias: this.parseBool(cols[17]),
      descricaoAjuda: cols[21]?.trim() || undefined,
      opcoesResposta: this.parseOpcoesResposta(cols),
    }));
  }

  /**
   * Faz o parse de uma linha CSV considerando aspas.
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result;
  }

  /**
   * Parse de valores booleanos do CSV.
   */
  private parseBool(value: string | undefined): boolean {
    if (!value) return false;
    const v = value.toLowerCase().trim();
    return v === 'sim' || v === 'yes' || v === 'true' || v === '1';
  }

  /**
   * Parse das opções de resposta (colunas 24-127).
   */
  private parseOpcoesResposta(cols: string[]): { texto: string; inconformidade?: boolean; pontos?: number }[] {
    const opcoes: { texto: string; inconformidade?: boolean; pontos?: number }[] = [];
    
    // Opções de resposta começam na coluna 24
    // Cada opção tem 7 colunas: texto, inconformidade, pontos, zeraGrupo, zeraChecklist, exigeFoto, comentario
    for (let i = 0; i < 15; i++) {
      const baseIndex = 24 + (i * 7);
      const texto = cols[baseIndex]?.trim();
      
      if (texto) {
        opcoes.push({
          texto,
          inconformidade: this.parseBool(cols[baseIndex + 1]),
          pontos: cols[baseIndex + 2] ? parseFloat(cols[baseIndex + 2]) : undefined,
        });
      }
    }
    
    return opcoes;
  }

  /**
   * Gera um preview da importação.
   */
  async preview(csvContent: string): Promise<ImportacaoPreview> {
    const lines = csvContent.split('\n').map((line) => this.parseCsvLine(line));
    
    // Extrai metadados do cabeçalho
    const nomeOriginal = lines[0]?.[1]?.trim() || 'Checklist Importado';
    const dataExportacao = lines[2]?.[1]?.replace('Arquivo exportado em ', '')?.trim() || '';
    
    const rows = this.parseCsv(csvContent);
    
    // Agrupa por grupo
    const gruposMap = new Map<string, { secoes: Set<string>; perguntas: number }>();
    
    rows.forEach((row) => {
      if (!row.grupo) return;
      
      if (!gruposMap.has(row.grupo)) {
        gruposMap.set(row.grupo, { secoes: new Set(), perguntas: 0 });
      }
      
      const grupo = gruposMap.get(row.grupo)!;
      if (row.secao) {
        grupo.secoes.add(row.secao);
      }
      grupo.perguntas++;
    });
    
    const grupos: ImportacaoGrupoPreview[] = Array.from(gruposMap.entries()).map(([nome, data]) => ({
      nome,
      secoes: Array.from(data.secoes),
      perguntas: data.perguntas,
    }));
    
    return {
      nomeOriginal,
      dataExportacao,
      grupos,
      totalPerguntas: rows.length,
      totalGrupos: grupos.length,
    };
  }

  /**
   * Importa um checklist do Moki.
   */
  async importar(csvContent: string, dto: ImportarMokiDto): Promise<ImportacaoResultado> {
    const rows = this.parseCsv(csvContent);
    
    if (rows.length === 0) {
      throw new BadRequestException('O arquivo CSV não contém dados válidos');
    }
    
    const avisos: string[] = [];
    
    // Cria o template
    const template = this.templateRepository.create({
      nome: dto.nomeTemplate,
      descricao: dto.descricao,
      tipoAtividade: dto.tipoAtividade || TipoAtividade.OUTRO,
      versao: dto.versao || '1.0',
    });
    const savedTemplate = await this.templateRepository.save(template);
    
    // Cria os grupos
    const gruposUnicos = [...new Set(rows.map((r) => r.grupo).filter(Boolean))];
    const grupoIdMap = new Map<string, string>();
    
    for (let i = 0; i < gruposUnicos.length; i++) {
      const grupoNome = gruposUnicos[i];
      const grupo = this.grupoRepository.create({
        nome: grupoNome,
        templateId: savedTemplate.id,
        ordem: i,
      });
      const savedGrupo = await this.grupoRepository.save(grupo);
      grupoIdMap.set(grupoNome, savedGrupo.id);
    }
    
    // Cria os itens
    let ordemGlobal = 0;
    for (const row of rows) {
      if (!row.pergunta) {
        avisos.push(`Linha ignorada: pergunta vazia`);
        continue;
      }
      
      const grupoId = row.grupo ? grupoIdMap.get(row.grupo) : undefined;
      
      // Determina categoria baseada no grupo
      const categoria = this.inferirCategoria(row.grupo);
      
      // Extrai opções de resposta
      const opcoesResposta = row.opcoesResposta?.length 
        ? row.opcoesResposta.map((o) => o.texto)
        : undefined;
      
      const item = this.itemRepository.create({
        pergunta: row.pergunta,
        templateId: savedTemplate.id,
        grupoId,
        secao: row.secao || undefined,
        categoria,
        criticidade: CriticidadeItem.MEDIA,
        peso: row.pontuacaoMaxima || 1,
        ordem: ordemGlobal++,
        obrigatorio: row.respostaObrigatoria ?? true,
        opcoesResposta,
        usarRespostasPersonalizadas: opcoesResposta && opcoesResposta.length > 0,
      });
      
      await this.itemRepository.save(item);
    }
    
    return {
      templateId: savedTemplate.id,
      nomeTemplate: savedTemplate.nome,
      gruposCriados: gruposUnicos.length,
      itensCriados: ordemGlobal,
      avisos,
    };
  }

  /**
   * Infere a categoria baseada no nome do grupo.
   */
  private inferirCategoria(grupo: string): CategoriaItem {
    if (!grupo) return CategoriaItem.OUTRO;
    
    const grupoLower = grupo.toLowerCase();
    
    if (grupoLower.includes('estrutura')) return CategoriaItem.ESTRUTURA;
    if (grupoLower.includes('higiene') || grupoLower.includes('higienização')) return CategoriaItem.HIGIENE;
    if (grupoLower.includes('manipula') || grupoLower.includes('colaborador') || grupoLower.includes('funcionário')) return CategoriaItem.MANIPULADORES;
    if (grupoLower.includes('documento') || grupoLower.includes('responsáve')) return CategoriaItem.DOCUMENTACAO;
    if (grupoLower.includes('estoque') || grupoLower.includes('armazen')) return CategoriaItem.ARMAZENAMENTO;
    if (grupoLower.includes('prepara') || grupoLower.includes('produção')) return CategoriaItem.PREPARACAO;
    if (grupoLower.includes('praga') || grupoLower.includes('controle')) return CategoriaItem.CONTROLE_PRAGAS;
    if (grupoLower.includes('equipamento')) return CategoriaItem.EQUIPAMENTOS;
    
    return CategoriaItem.OUTRO;
  }
}

