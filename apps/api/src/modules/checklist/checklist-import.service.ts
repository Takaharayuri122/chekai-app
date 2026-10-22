import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ChecklistTemplate, StatusTemplate } from './entities/checklist-template.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import { TemplateItem } from './entities/template-item.entity';
import { configuracaoParaItem, mapearLinhaImportada } from './checklist-import-mapeamento';
import { TipoAtividade } from '../cliente/entities/cliente.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import {
  ImportarChecklistDto,
  ConfirmarImportacaoDto,
  ChecklistCsvRow,
  ImportacaoPreview,
  ImportacaoGrupoPreview,
  ImportacaoResultado,
} from './dto/importar-checklist.dto';

/**
 * Serviço responsável pela importação de checklists.
 */
@Injectable()
export class ChecklistImportService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private readonly templateRepository: Repository<ChecklistTemplate>,
    @InjectRepository(ChecklistGrupo)
    private readonly grupoRepository: Repository<ChecklistGrupo>,
    @InjectRepository(TemplateItem)
    private readonly itemRepository: Repository<TemplateItem>,
  ) {}

  /**
   * Faz o parse de um arquivo XLSX.
   */
  parseXlsx(buffer: Buffer): ChecklistCsvRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    if (data.length < 6) {
      throw new BadRequestException('O arquivo XLSX não contém dados válidos');
    }
    const dataLines = data.slice(5).filter((row) => row && row.length > 2 && row[2]?.toString().trim());
    return dataLines.map((row) => ({
      grupo: row[0]?.toString().trim() || '',
      secao: row[1]?.toString().trim() || '',
      pergunta: row[2]?.toString().trim() || '',
      tipoResposta: row[3]?.toString().trim() || undefined,
      pontuacaoMaxima: row[4] ? parseFloat(row[4].toString()) : undefined,
      processo: row[5]?.toString().trim() || undefined,
      tags: row[6]?.toString().trim() || undefined,
      perguntaAtiva: this.parseBool(row[7]?.toString()),
      respostaObrigatoria: this.parseBool(row[8]?.toString()),
      justificativaObrigatoria: this.parseBool(row[9]?.toString()),
      permiteComentario: this.parseBool(row[11]?.toString()),
      permiteFotos: this.parseBool(row[16]?.toString()),
      fotosObrigatorias: this.parseBool(row[17]?.toString()),
      descricaoAjuda: row[21]?.toString().trim() || undefined,
      opcoesResposta: this.parseOpcoesRespostaXlsx(row),
    }));
  }

  /**
   * Faz o parse de um arquivo CSV.
   */
  parseCsv(csvContent: string): ChecklistCsvRow[] {
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
  private parseBool(value: string | undefined): boolean | undefined {
    const v = (value ?? '').toLowerCase().trim();
    if (!v) return undefined;
    return v === 'sim' || v === 'yes' || v === 'true' || v === '1';
  }

  /**
   * Parse das opções de resposta (colunas 24-127).
   */
  private parseOpcoesResposta(cols: string[]): { texto: string; inconformidade?: boolean; pontos?: number }[] {
    const opcoes: { texto: string; inconformidade?: boolean; pontos?: number }[] = [];
    for (let i = 0; i < 15; i++) {
      const baseIndex = 24 + (i * 7);
      const texto = cols[baseIndex]?.trim();
      if (texto) {
        opcoes.push({
          texto,
          inconformidade: this.parseBool(cols[baseIndex + 1]) ?? false,
          pontos: cols[baseIndex + 2] ? parseFloat(cols[baseIndex + 2]) : undefined,
        });
      }
    }
    return opcoes;
  }

  /**
   * Parse das opções de resposta para XLSX (colunas 24-127).
   */
  private parseOpcoesRespostaXlsx(row: any[]): { texto: string; inconformidade?: boolean; pontos?: number }[] {
    const opcoes: { texto: string; inconformidade?: boolean; pontos?: number }[] = [];
    for (let i = 0; i < 15; i++) {
      const baseIndex = 24 + (i * 7);
      const texto = row[baseIndex]?.toString().trim();
      if (texto) {
        opcoes.push({
          texto,
          inconformidade: this.parseBool(row[baseIndex + 1]?.toString()) ?? false,
          pontos: row[baseIndex + 2] ? parseFloat(row[baseIndex + 2].toString()) : undefined,
        });
      }
    }
    return opcoes;
  }

  /**
   * Gera um preview da importação.
   */
  async preview(csvContent?: string, xlsxBuffer?: Buffer): Promise<ImportacaoPreview> {
    let rows: ChecklistCsvRow[];
    let nomeOriginal = 'Checklist Importado';
    let dataExportacao = '';
    if (xlsxBuffer) {
      const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      if (data.length > 0) {
        nomeOriginal = data[0]?.[1]?.toString().trim() || 'Checklist Importado';
        dataExportacao = data[2]?.[1]?.toString().replace('Arquivo exportado em ', '')?.trim() || '';
      }
      rows = this.parseXlsx(xlsxBuffer);
    } else if (csvContent) {
      const lines = csvContent.split('\n').map((line) => this.parseCsvLine(line));
      nomeOriginal = lines[0]?.[1]?.trim() || 'Checklist Importado';
      dataExportacao = lines[2]?.[1]?.replace('Arquivo exportado em ', '')?.trim() || '';
      rows = this.parseCsv(csvContent);
    } else {
      throw new BadRequestException('Conteúdo do arquivo não fornecido');
    }
    
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
      perguntas: rows.map((row, indice) => mapearLinhaImportada(row, indice)),
    };
  }

  /**
   * Importa um checklist.
   */
  async importar(
    csvContent?: string,
    dto?: ImportarChecklistDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
    xlsxBuffer?: Buffer,
  ): Promise<ImportacaoResultado> {
    if (!dto) {
      throw new BadRequestException('DTO de importação não fornecido');
    }
    let rows: ChecklistCsvRow[];
    if (xlsxBuffer) {
      rows = this.parseXlsx(xlsxBuffer);
    } else if (csvContent) {
      rows = this.parseCsv(csvContent);
    } else {
      throw new BadRequestException('Conteúdo do arquivo não fornecido');
    }
    if (rows.length === 0) {
      throw new BadRequestException('O arquivo não contém dados válidos');
    }
    
    const avisos: string[] = [];
    
    // Cria o template
    const template = this.templateRepository.create({
      nome: dto.nomeTemplate,
      descricao: dto.descricao,
      tipoAtividade: dto.tipoAtividade || TipoAtividade.OUTRO,
      versao: dto.versao || '1.0',
      gestorId: usuarioAutenticado?.id ?? undefined,
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
      
      const { configuracao } = mapearLinhaImportada(row, ordemGlobal);
      const item = this.itemRepository.create({
        ...configuracaoParaItem(configuracao),
        pergunta: row.pergunta,
        templateId: savedTemplate.id,
        grupoId,
        secao: row.secao || undefined,
        ordem: ordemGlobal++,
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
   * Confirma a importação a partir das perguntas revisadas, em uma única transação.
   * Cria o template como rascunho, os grupos (com ao menos uma pergunta) e os itens.
   */
  async confirmar(
    dto: ConfirmarImportacaoDto,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<ImportacaoResultado> {
    const avisos: string[] = [];

    return this.templateRepository.manager.transaction(async (manager) => {
      const template = await manager.save(
        ChecklistTemplate,
        manager.create(ChecklistTemplate, {
          nome: dto.dados.nomeTemplate,
          descricao: dto.dados.descricao,
          tipoAtividade: dto.dados.tipoAtividade || TipoAtividade.OUTRO,
          versao: dto.dados.versao || '1.0',
          status: StatusTemplate.RASCUNHO,
          gestorId: usuario.id,
        }),
      );

      let gruposCriados = 0;
      let ordemGlobal = 0;

      for (const grupoDto of dto.grupos) {
        const perguntas = grupoDto.perguntas.filter((p) => {
          if (p.pergunta?.trim()) return true;
          avisos.push(`Pergunta vazia ignorada no grupo "${grupoDto.nome}"`);
          return false;
        });
        if (perguntas.length === 0) continue;

        const grupo = await manager.save(
          ChecklistGrupo,
          manager.create(ChecklistGrupo, {
            nome: grupoDto.nome,
            templateId: template.id,
            ordem: gruposCriados,
          }),
        );
        gruposCriados++;

        for (const p of perguntas) {
          await manager.save(
            TemplateItem,
            manager.create(TemplateItem, {
              ...configuracaoParaItem(p.configuracao),
              pergunta: p.pergunta.trim(),
              templateId: template.id,
              grupoId: grupo.id,
              secao: p.secao || undefined,
              ordem: ordemGlobal++,
            }),
          );
        }
      }

      return {
        templateId: template.id,
        nomeTemplate: template.nome,
        gruposCriados,
        itensCriados: ordemGlobal,
        avisos,
      };
    });
  }
}
