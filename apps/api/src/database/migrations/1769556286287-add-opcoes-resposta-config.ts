import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpcoesRespostaConfig1769556286287 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna se não existir
    await queryRunner.query(`
      ALTER TABLE template_itens
      ADD COLUMN IF NOT EXISTS "opcoesRespostaConfig" JSONB DEFAULT '[]'::jsonb NOT NULL
    `);

    // Popular configs para perguntas existentes com respostas personalizadas
    // Nota: opcoesResposta é um simple-array (text com valores separados por vírgula)
    await queryRunner.query(`
      UPDATE template_itens
      SET "opcoesRespostaConfig" = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'valor', trim(opcao),
            'fotoObrigatoria', false,
            'observacaoObrigatoria', false
          )
        )
        FROM unnest(string_to_array("opcoesResposta", ',')) opcao
      )
      WHERE ("usarRespostasPersonalizadas" = true OR "tipoRespostaCustomizada" = 'select')
        AND "opcoesResposta" IS NOT NULL
        AND "opcoesResposta" != ''
    `);

    // Popular configs para perguntas com respostas padrão
    await queryRunner.query(`
      UPDATE template_itens
      SET "opcoesRespostaConfig" = '[
        {"valor":"conforme","fotoObrigatoria":false,"observacaoObrigatoria":false},
        {"valor":"nao_conforme","fotoObrigatoria":false,"observacaoObrigatoria":false},
        {"valor":"nao_aplicavel","fotoObrigatoria":false,"observacaoObrigatoria":false},
        {"valor":"nao_avaliado","fotoObrigatoria":false,"observacaoObrigatoria":false}
      ]'::jsonb
      WHERE ("usarRespostasPersonalizadas" = false OR "usarRespostasPersonalizadas" IS NULL)
        AND ("tipoRespostaCustomizada" IS NULL OR "tipoRespostaCustomizada" != 'select')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE template_itens
      DROP COLUMN "opcoesRespostaConfig"
    `);
  }
}
