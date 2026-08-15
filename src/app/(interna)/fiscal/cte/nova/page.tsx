'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Paper,
  Title,
  Stepper,
  Button,
  Group,
  Grid,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Divider,
  ActionIcon,
  Text,
  Badge,
  Accordion,
  Stack,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useCte } from '@/data/hooks/fiscal/useCte'
import { api } from '@/lib/api'

const TIPOS_SERVICO = [
  { value: '0', label: '0 - Normal' },
  { value: '1', label: '1 - Subcontratação' },
  { value: '2', label: '2 - Redespacho' },
  { value: '3', label: '3 - Redespacho Intermediário' },
  { value: '4', label: '4 - Serviço Vinculado a Multimodal' },
]

const MODAIS = [
  { value: '01', label: '01 - Rodoviário' },
  { value: '02', label: '02 - Aéreo' },
  { value: '03', label: '03 - Aquaviário' },
  { value: '04', label: '04 - Ferroviário' },
  { value: '05', label: '05 - Dutoviário' },
  { value: '06', label: '06 - Multimodal' },
]

const TIPOS_TOMADOR = [
  { value: '0', label: '0 - Remetente' },
  { value: '1', label: '1 - Expedidor' },
  { value: '2', label: '2 - Recebedor' },
  { value: '3', label: '3 - Destinatário' },
  { value: '4', label: '4 - Outros' },
]

const CST_ICMS = [
  { value: '00', label: '00 - Tributação normal' },
  { value: '20', label: '20 - Com redução de BC' },
  { value: '40', label: '40 - Isenta' },
  { value: '41', label: '41 - Não tributada' },
  { value: '51', label: '51 - Diferido' },
  { value: '60', label: '60 - ICMS cobrado anteriormente por ST' },
  { value: '90', label: '90 - Outros' },
  { value: 'SN', label: 'SN - Simples Nacional' },
]

const RESP_SEGURO = [
  { value: '0', label: '0 - Remetente' },
  { value: '1', label: '1 - Expedidor' },
  { value: '2', label: '2 - Recebedor' },
  { value: '3', label: '3 - Destinatário' },
  { value: '4', label: '4 - Emitente do CT-e' },
  { value: '5', label: '5 - Tomador do Serviço' },
]

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
].map(uf => ({ value: uf, label: uf }))

interface Participante {
  cnpj: string
  cpf: string
  ie: string
  razaoSocial: string
  nomeFantasia: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  codigoMunicipio: string
  municipio: string
  uf: string
  cep: string
  email: string
  telefone: string
}

interface NFeVinculada {
  chave: string
}

interface SeguroItem {
  respSeg: string
  xSeg: string
  nApol: string
  nAver: string
  vCarga: number
}

interface ValePedagioItem {
  cnpjForn: string
  cnpjPg: string
  nCompra: string
  vValePed: number
}

function participanteVazio(): Participante {
  return {
    cnpj: '', cpf: '', ie: '', razaoSocial: '', nomeFantasia: '',
    logradouro: '', numero: '', complemento: '', bairro: '',
    codigoMunicipio: '', municipio: '', uf: '', cep: '', email: '', telefone: '',
  }
}

export default function CteNovaPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Emissão de CT-e' }, [])

  const router = useRouter()
  const searchParams = useSearchParams()
  const { useEmitir, useGravar, useAtualizar, useDetalhe, useDefaults, buscarParticipante } = useCte()
  const emitirMutation = useEmitir()
  const gravarMutation = useGravar()
  const atualizarMutation = useAtualizar()
  const { data: defaults } = useDefaults()

  const [active, setActive] = useState(0)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  // Step 1 — Dados Gerais (pré-preenchidos dos defaults)
  const [naturezaOp, setNaturezaOp] = useState('PRESTACAO DE SERVICO DE TRANSPORTE')
  const [cfop, setCfop] = useState('5353')
  const [tpServ, setTpServ] = useState('0')
  const [modal, setModal] = useState('01')
  const [tpCTe, setTpCTe] = useState('0')
  const [serie, setSerie] = useState(1)

  // Origem/Destino
  const [cMunIni, setCMunIni] = useState('')
  const [xMunIni, setXMunIni] = useState('')
  const [ufIni, setUfIni] = useState('')
  const [cMunFim, setCMunFim] = useState('')
  const [xMunFim, setXMunFim] = useState('')
  const [ufFim, setUfFim] = useState('')

  // Step 2 — Tomador
  const [tpTom, setTpTom] = useState('0')
  const [indIEToma, setIndIEToma] = useState('9')

  // Step 3 — Participantes
  const [remetente, setRemetente] = useState<Participante>(participanteVazio())
  const [destinatario, setDestinatario] = useState<Participante>(participanteVazio())

  // Step 4 — Carga
  const [proPred, setProPred] = useState('')
  const [vCarga, setVCarga] = useState<number>(0)
  const [pesoBruto, setPesoBruto] = useState<number>(0)
  const [nfesVinculadas, setNfesVinculadas] = useState<NFeVinculada[]>([{ chave: '' }])

  // Step 5 — Valor da Prestação
  const [vTPrest, setVTPrest] = useState<number>(0)
  const [vRec, setVRec] = useState<number>(0)

  // Step 6 — ICMS
  const [cstIcms, setCstIcms] = useState('00')
  const [bcIcms, setBcIcms] = useState<number>(0)
  const [aliqIcms, setAliqIcms] = useState<number>(0)
  const [valorIcms, setValorIcms] = useState<number>(0)

  // Step 7 — Seguros
  const [seguros, setSeguros] = useState<SeguroItem[]>([])

  // Step 8 — Vale-Pedágio
  const [valesPedagio, setValesPedagio] = useState<ValePedagioItem[]>([])

  // Veículos Novos (transporte de carros)
  const [tipoCarga, setTipoCarga] = useState<'NORMAL' | 'VEICULO_NOVO' | 'VEICULO_USADO'>('NORMAL')
  const [veiculosNovos, setVeiculosNovos] = useState<Array<{
    chassi: string; cCor: string; xCor: string; cMod: string; vUnit: number; vFrete: number
  }>>([])

  // Step 9 — Observações
  const [infCpl, setInfCpl] = useState('')
  const [rntrc, setRntrc] = useState('')

  const totalSteps = 7

  // === Carregar defaults da empresa ao montar ===
  useEffect(() => {
    if (defaults) {
      if (defaults.naturezaOp) setNaturezaOp(defaults.naturezaOp)
      if (defaults.modal) setModal(defaults.modal)
      if (defaults.serie) setSerie(defaults.serie)
      if (defaults.rntrc) setRntrc(defaults.rntrc)
      if (defaults.cstIcms) setCstIcms(defaults.cstIcms)
      if (defaults.aliqIcms) setAliqIcms(defaults.aliqIcms)
      if (defaults.seguradora && defaults.apolice) {
        setSeguros([{ respSeg: '4', xSeg: defaults.seguradora, nApol: defaults.apolice, nAver: '', vCarga: 0 }])
      }
      if (defaults.ufEmitente) {
        setUfIni(defaults.ufEmitente)
      }
    }
  }, [defaults])

  // === Carregar dados importados de NF-e (sessionStorage) ===
  useEffect(() => {
    const importado = sessionStorage.getItem('cte_importado')
    if (importado) {
      try {
        const dados = JSON.parse(importado)
        sessionStorage.removeItem('cte_importado')
        // Preencher tudo do CT-e importado
        if (dados.cfop) setCfop(dados.cfop)
        if (dados.naturezaOp) setNaturezaOp(dados.naturezaOp)
        if (dados.serie) setSerie(dados.serie)
        if (dados.modal) setModal(dados.modal)
        if (dados.cMunIni) setCMunIni(dados.cMunIni)
        if (dados.xMunIni) setXMunIni(dados.xMunIni)
        if (dados.ufIni) setUfIni(dados.ufIni)
        if (dados.cMunFim) setCMunFim(dados.cMunFim)
        if (dados.xMunFim) setXMunFim(dados.xMunFim)
        if (dados.ufFim) setUfFim(dados.ufFim)
        if (dados.rntrc) setRntrc(dados.rntrc)
        if (dados.cstIcms) setCstIcms(dados.cstIcms)
        if (dados.aliqIcms) setAliqIcms(dados.aliqIcms)
        if (dados.remetente) {
          setRemetente({
            cnpj: dados.remetente.cnpj || '',
            cpf: dados.remetente.cpf || '',
            ie: dados.remetente.ie || '',
            razaoSocial: dados.remetente.razaoSocial || '',
            nomeFantasia: dados.remetente.nomeFantasia || '',
            logradouro: dados.remetente.logradouro || '',
            numero: dados.remetente.numero || '',
            complemento: dados.remetente.complemento || '',
            bairro: dados.remetente.bairro || '',
            codigoMunicipio: dados.remetente.codigoMunicipio || '',
            municipio: dados.remetente.municipio || '',
            uf: dados.remetente.uf || '',
            cep: dados.remetente.cep || '',
            email: dados.remetente.email || '',
            telefone: dados.remetente.telefone || '',
          })
        }
        if (dados.destinatario) {
          setDestinatario({
            cnpj: dados.destinatario.cnpj || '',
            cpf: dados.destinatario.cpf || '',
            ie: dados.destinatario.ie || '',
            razaoSocial: dados.destinatario.razaoSocial || '',
            nomeFantasia: dados.destinatario.nomeFantasia || '',
            logradouro: dados.destinatario.logradouro || '',
            numero: dados.destinatario.numero || '',
            complemento: dados.destinatario.complemento || '',
            bairro: dados.destinatario.bairro || '',
            codigoMunicipio: dados.destinatario.codigoMunicipio || '',
            municipio: dados.destinatario.municipio || '',
            uf: dados.destinatario.uf || '',
            cep: dados.destinatario.cep || '',
            email: dados.destinatario.email || '',
            telefone: dados.destinatario.telefone || '',
          })
        }
        if (dados.infCarga) {
          if (dados.infCarga.vCarga) setVCarga(dados.infCarga.vCarga)
          if (dados.infCarga.proPred) setProPred(dados.infCarga.proPred)
          if (dados.infCarga.pesoBruto) setPesoBruto(dados.infCarga.pesoBruto)
        }
        if (dados.nfesVinculadas) {
          setNfesVinculadas(dados.nfesVinculadas)
        }
        if (dados.veicNovos && dados.veicNovos.length > 0) {
          setTipoCarga('VEICULO_NOVO')
          setVeiculosNovos(dados.veicNovos.map((v: any) => ({
            chassi: v.chassi || '', cCor: v.cCor || '', xCor: v.xCor || '',
            cMod: v.cMod || '', vUnit: v.vUnit || 0, vFrete: 0,
          })))
        }

        // Auto-consulta de CNPJ não necessária — o backend já fez via resolverParticipante
      } catch { /* ignora erro de parse */ }
    }
  }, [])

  // === Carregar dados de CT-e existente para edição ===
  useEffect(() => {
    const editarId = searchParams.get('editar')
    if (!editarId) return
    setEditandoId(editarId)
    api.get(`/fiscal/cte/${editarId}`).then(({ data }) => {
      const dados = data.dadosEmissao
      if (!dados) return
      if (dados.cfop) setCfop(dados.cfop)
      if (dados.naturezaOp) setNaturezaOp(dados.naturezaOp)
      if (dados.serie) setSerie(dados.serie)
      if (dados.modal) setModal(dados.modal)
      if (dados.tpServ !== undefined) setTpServ(String(dados.tpServ))
      if (dados.tpCTe !== undefined) setTpCTe(String(dados.tpCTe))
      if (dados.cMunIni) setCMunIni(dados.cMunIni)
      if (dados.xMunIni) setXMunIni(dados.xMunIni)
      if (dados.ufIni) setUfIni(dados.ufIni)
      if (dados.cMunFim) setCMunFim(dados.cMunFim)
      if (dados.xMunFim) setXMunFim(dados.xMunFim)
      if (dados.ufFim) setUfFim(dados.ufFim)
      if (dados.tpTom !== undefined) setTpTom(String(dados.tpTom))
      if (dados.indIEToma !== undefined) setIndIEToma(String(dados.indIEToma))
      if (dados.infCTeNorm?.infModal?.RNTRC) setRntrc(dados.infCTeNorm.infModal.RNTRC)
      if (dados.impostos?.icms) {
        if (dados.impostos.icms.cst) setCstIcms(dados.impostos.icms.cst)
        if (dados.impostos.icms.aliquota) setAliqIcms(dados.impostos.icms.aliquota)
        if (dados.impostos.icms.baseCalculo) setBcIcms(dados.impostos.icms.baseCalculo)
        if (dados.impostos.icms.valor) setValorIcms(dados.impostos.icms.valor)
      }
      if (dados.remetente) {
        setRemetente({
          cnpj: dados.remetente.cnpj || '', cpf: dados.remetente.cpf || '', ie: dados.remetente.ie || '',
          razaoSocial: dados.remetente.razaoSocial || '', nomeFantasia: dados.remetente.nomeFantasia || '',
          logradouro: dados.remetente.endereco?.logradouro || '', numero: dados.remetente.endereco?.numero || '',
          complemento: dados.remetente.endereco?.complemento || '', bairro: dados.remetente.endereco?.bairro || '',
          codigoMunicipio: dados.remetente.endereco?.codigoMunicipio || '', municipio: dados.remetente.endereco?.municipio || '',
          uf: dados.remetente.endereco?.uf || '', cep: dados.remetente.endereco?.cep || '',
          email: dados.remetente.email || '', telefone: dados.remetente.telefone || '',
        })
      }
      if (dados.destinatario) {
        setDestinatario({
          cnpj: dados.destinatario.cnpj || '', cpf: dados.destinatario.cpf || '', ie: dados.destinatario.ie || '',
          razaoSocial: dados.destinatario.razaoSocial || '', nomeFantasia: dados.destinatario.nomeFantasia || '',
          logradouro: dados.destinatario.endereco?.logradouro || '', numero: dados.destinatario.endereco?.numero || '',
          complemento: dados.destinatario.endereco?.complemento || '', bairro: dados.destinatario.endereco?.bairro || '',
          codigoMunicipio: dados.destinatario.endereco?.codigoMunicipio || '', municipio: dados.destinatario.endereco?.municipio || '',
          uf: dados.destinatario.endereco?.uf || '', cep: dados.destinatario.endereco?.cep || '',
          email: dados.destinatario.email || '', telefone: dados.destinatario.telefone || '',
        })
      }
      if (dados.vPrest) {
        if (dados.vPrest.vTPrest) setVTPrest(dados.vPrest.vTPrest)
        if (dados.vPrest.vRec) setVRec(dados.vPrest.vRec)
      }
      if (dados.infCTeNorm?.infCarga) {
        if (dados.infCTeNorm.infCarga.vCarga) setVCarga(dados.infCTeNorm.infCarga.vCarga)
        if (dados.infCTeNorm.infCarga.proPred) setProPred(dados.infCTeNorm.infCarga.proPred)
        if (dados.infCTeNorm.infCarga.infQ?.[0]?.qCarga) setPesoBruto(dados.infCTeNorm.infCarga.infQ[0].qCarga)
      }
      if (dados.infCTeNorm?.infDoc?.infNFe) {
        setNfesVinculadas(dados.infCTeNorm.infDoc.infNFe.map((n: any) => ({ chave: n.chave })))
      }
      if (dados.infCTeNorm?.veicNovos?.length > 0) {
        setTipoCarga('VEICULO_NOVO')
        setVeiculosNovos(dados.infCTeNorm.veicNovos.map((v: any) => ({
          chassi: v.chassi || '', cCor: v.cCor || '', xCor: v.xCor || '',
          cMod: v.cMod || '', vUnit: v.vUnit || 0, vFrete: v.vFrete || 0,
        })))
      }
      if (dados.infCpl) setInfCpl(dados.infCpl)
    }).catch(() => {
      notifications.show({ title: 'Erro', message: 'Não foi possível carregar o CT-e para edição', color: 'red' })
    })
  }, [searchParams])

  // === Calcular CFOP automaticamente pela UF origem vs destino ===
  useEffect(() => {
    if (ufIni && ufFim) {
      setCfop(ufIni === ufFim ? '5353' : '6353')
    }
  }, [ufIni, ufFim])

  // === Valor a Receber = Valor Total da Prestação (espelhar) ===
  useEffect(() => {
    setVRec(vTPrest)
  }, [vTPrest])

  // === Base de Cálculo ICMS = Valor Total da Prestação ===
  useEffect(() => {
    setBcIcms(vTPrest)
  }, [vTPrest])

  // === Valor ICMS = Base de Cálculo × Alíquota / 100 ===
  useEffect(() => {
    const valor = Math.round(bcIcms * aliqIcms) / 100
    setValorIcms(valor)
  }, [bcIcms, aliqIcms])

  // === Buscar participante por CNPJ ===
  async function buscarEPreencher(cpfCnpj: string, setParticipante: (p: Participante) => void) {
    const doc = cpfCnpj.replace(/\D/g, '')
    if (doc.length < 11) return
    try {
      // Primeiro tenta no cadastro interno
      const resultado = await buscarParticipante(doc)
      if (resultado.encontrado && resultado.logradouro) {
        setParticipante({
          cnpj: resultado.cnpj?.length === 14 ? resultado.cnpj : '',
          cpf: resultado.cnpj?.length === 11 ? resultado.cnpj : '',
          ie: resultado.ie || '',
          razaoSocial: resultado.razaoSocial || '',
          nomeFantasia: resultado.nomeFantasia || '',
          logradouro: resultado.logradouro || '',
          numero: resultado.numero || '',
          complemento: resultado.complemento || '',
          bairro: resultado.bairro || '',
          codigoMunicipio: resultado.codigoMunicipio || '',
          municipio: resultado.municipio || '',
          uf: resultado.uf || '',
          cep: resultado.cep || '',
          email: resultado.email || '',
          telefone: resultado.telefone || '',
        })
        return
      }

      // Se não encontrou com endereço, consulta pela API pública (BrasilAPI)
      if (doc.length === 14) {
        const { data } = await api.get(`/empresas/consulta-cnpj/${doc}`)
        if (data) {
          setParticipante((prev: any) => ({
            ...prev,
            cnpj: doc,
            razaoSocial: data.razaoSocial || prev.razaoSocial || '',
            nomeFantasia: data.nomeFantasia || '',
            ie: data.inscEstadual || prev.ie || '',
            logradouro: data.logradouro || '',
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            codigoMunicipio: data.codigoMunicipio || '',
            municipio: data.cidade || '',
            uf: data.uf || '',
            cep: data.cep || '',
            email: data.email || '',
            telefone: data.telefone || '',
          }))
        }
      }
    } catch { /* silencioso */ }
  }

  function adicionarNFe() {
    setNfesVinculadas([...nfesVinculadas, { chave: '' }])
  }

  function removerNFe(index: number) {
    setNfesVinculadas(nfesVinculadas.filter((_, i) => i !== index))
  }

  function adicionarSeguro() {
    setSeguros([...seguros, { respSeg: '4', xSeg: '', nApol: '', nAver: '', vCarga: 0 }])
  }

  function adicionarValePedagio() {
    setValesPedagio([...valesPedagio, { cnpjForn: '', cnpjPg: '', nCompra: '', vValePed: 0 }])
  }

  function montarPayload() {
    const formatPart = (p: Participante) => ({
      cnpj: p.cnpj || undefined,
      cpf: p.cpf || undefined,
      ie: p.ie || undefined,
      razaoSocial: p.razaoSocial,
      nomeFantasia: p.nomeFantasia || undefined,
      endereco: {
        logradouro: p.logradouro,
        numero: p.numero,
        complemento: p.complemento || undefined,
        bairro: p.bairro,
        codigoMunicipio: p.codigoMunicipio,
        municipio: p.municipio,
        uf: p.uf,
        cep: p.cep,
      },
      email: p.email || undefined,
      telefone: p.telefone || undefined,
    })

    return {
      serie,
      cfop,
      naturezaOp,
      tpServ: Number(tpServ),
      tpCTe: Number(tpCTe),
      modal,
      tpEmis: 1,
      cMunIni, xMunIni, ufIni,
      cMunFim, xMunFim, ufFim,
      tpTom: Number(tpTom),
      indIEToma: Number(indIEToma),
      remetente: formatPart(remetente),
      destinatario: formatPart(destinatario),
      vPrest: {
        vTPrest: vTPrest,
        vRec: vRec || vTPrest,
        componentes: [
          { nome: 'FRETE VALOR', valor: vTPrest },
        ],
      },
      impostos: {
        icms: {
          cst: cstIcms,
          baseCalculo: bcIcms,
          aliquota: aliqIcms,
          valor: valorIcms,
        },
      },
      infCTeNorm: {
        infCarga: {
          vCarga,
          proPred,
          infQ: [
            { cUnid: '01', tpMed: 'PESO BRUTO', qCarga: pesoBruto || 1 },
          ],
        },
        infDoc: {
          infNFe: nfesVinculadas
            .filter(n => n.chave.length === 44)
            .map(n => ({ chave: n.chave })),
        },
        infModal: rntrc ? { RNTRC: rntrc } : undefined,
        seguro: seguros.length > 0 ? seguros.map(s => ({
          respSeg: Number(s.respSeg),
          xSeg: s.xSeg || undefined,
          nApol: s.nApol || undefined,
          nAver: s.nAver || undefined,
          vCarga: s.vCarga || undefined,
        })) : undefined,
        valePedagio: valesPedagio.length > 0 ? valesPedagio.map(v => ({
          cnpjForn: v.cnpjForn,
          cnpjPg: v.cnpjPg || undefined,
          nCompra: v.nCompra,
          vValePed: v.vValePed,
        })) : undefined,
        veicNovos: tipoCarga === 'VEICULO_NOVO' && veiculosNovos.length > 0
          ? veiculosNovos.filter(v => v.chassi.length === 17)
          : undefined,
      },
      infCpl: infCpl || undefined,
      ambiente: 2,
    }
  }

  async function handleEmitir() {
    const payload = montarPayload()
    if (editandoId) {
      // Modo edição: atualizar CT-e existente
      atualizarMutation.mutate({ id: editandoId, payload }, {
        onSuccess: (response: any) => {
          notifications.show({
            title: 'CT-e Atualizado',
            message: `Nº ${response?.numero || ''} / Série ${response?.serie || ''} — atualizado com sucesso.`,
            color: 'green',
          })
          router.push('/fiscal/cte')
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro ao Atualizar',
            message: err?.response?.data?.message || err?.response?.data?.erros?.[0]?.message || 'Erro ao atualizar CT-e',
            color: 'red',
          })
        },
      })
    } else {
      // Modo criação: gravar novo CT-e
      emitirMutation.mutate(payload, {
        onSuccess: (response: any) => {
          notifications.show({
            title: 'CT-e Gravado',
            message: `Nº ${response?.numero || ''} / Série ${response?.serie || ''} — Status: DIGITADA. Transmita pela listagem.`,
            color: 'green',
          })
          router.push('/fiscal/cte')
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro ao Gravar',
            message: err?.response?.data?.message || err?.response?.data?.erros?.[0]?.message || 'Erro ao gravar CT-e',
            color: 'red',
          })
        },
      })
    }
  }

  function renderParticipanteForm(p: Participante, setP: (v: Participante) => void, titulo: string) {
    return (
      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">{titulo}</Text>
        <Grid>
          <Grid.Col span={4}>
            <TextInput label="CNPJ" value={p.cnpj}
              onChange={(e) => setP({ ...p, cnpj: e.target.value })} maxLength={14}
              onBlur={() => { if (p.cnpj.length >= 11) buscarEPreencher(p.cnpj, setP) }}
              description="Ao sair do campo, busca no cadastro" />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="CPF" value={p.cpf}
              onChange={(e) => setP({ ...p, cpf: e.target.value })} maxLength={11} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="IE" value={p.ie}
              onChange={(e) => setP({ ...p, ie: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={8}>
            <TextInput label="Razão Social" value={p.razaoSocial} required
              onChange={(e) => setP({ ...p, razaoSocial: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Nome Fantasia" value={p.nomeFantasia}
              onChange={(e) => setP({ ...p, nomeFantasia: e.target.value })} />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput label="Logradouro" value={p.logradouro} required
              onChange={(e) => setP({ ...p, logradouro: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={2}>
            <TextInput label="Número" value={p.numero} required
              onChange={(e) => setP({ ...p, numero: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Bairro" value={p.bairro} required
              onChange={(e) => setP({ ...p, bairro: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="Cód. Município (IBGE)" value={p.codigoMunicipio} required
              onChange={(e) => setP({ ...p, codigoMunicipio: e.target.value })} maxLength={7} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Município" value={p.municipio} required
              onChange={(e) => setP({ ...p, municipio: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select label="UF" data={UFS} value={p.uf}
              onChange={(v) => setP({ ...p, uf: v || '' })} searchable />
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="CEP" value={p.cep} required
              onChange={(e) => setP({ ...p, cep: e.target.value })} maxLength={8} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="E-mail" value={p.email}
              onChange={(e) => setP({ ...p, email: e.target.value })} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Telefone" value={p.telefone}
              onChange={(e) => setP({ ...p, telefone: e.target.value })} />
          </Grid.Col>
        </Grid>
      </Paper>
    )
  }

  return (
    <Paper p="md">
      <Title order={3} mb="lg">{editandoId ? 'Editar CT-e' : 'Emissão de CT-e'}</Title>
      <Text size="sm" c="dimmed" mb="md">Início / Fiscal / CT-e / {editandoId ? 'Editar' : 'Nova Emissão'}</Text>

      <Stepper active={active} onStepClick={setActive} mb="xl" size="sm">
        <Stepper.Step label="Dados Gerais" />
        <Stepper.Step label="Participantes" />
        <Stepper.Step label="Carga" />
        <Stepper.Step label="Valor / ICMS" />
        <Stepper.Step label="Seguro / Pedágio" />
        <Stepper.Step label="NF-e Vinculadas" />
        <Stepper.Step label="Revisão" />
      </Stepper>

      {/* Step 0 — Dados Gerais */}
      {active === 0 && (
        <Grid>
          <Grid.Col span={6}>
            <TextInput label="Natureza da Operação" value={naturezaOp}
              onChange={(e) => setNaturezaOp(e.target.value)} required />
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="CFOP" value={cfop}
              onChange={(e) => setCfop(e.target.value)} required maxLength={4} />
          </Grid.Col>
          <Grid.Col span={3}>
            <NumberInput label="Série" value={serie}
              onChange={(v) => setSerie(Number(v) || 1)} min={0} max={999} />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select label="Tipo de Serviço" data={TIPOS_SERVICO} value={tpServ}
              onChange={(v) => setTpServ(v || '0')} />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select label="Modal" data={MODAIS} value={modal}
              onChange={(v) => setModal(v || '01')} />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select label="Tomador" data={TIPOS_TOMADOR} value={tpTom}
              onChange={(v) => setTpTom(v || '0')} />
          </Grid.Col>

          <Grid.Col span={12}><Divider label="Origem" /></Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="Cód. Município Origem (IBGE)" value={cMunIni}
              onChange={(e) => setCMunIni(e.target.value)} maxLength={7} required />
          </Grid.Col>
          <Grid.Col span={5}>
            <TextInput label="Município Origem" value={xMunIni}
              onChange={(e) => setXMunIni(e.target.value)} required />
          </Grid.Col>

          <Grid.Col span={2}>
            <Select label="UF Origem" data={UFS} value={ufIni}
              onChange={(v) => setUfIni(v || '')} searchable />
          </Grid.Col>

          <Grid.Col span={12}><Divider label="Destino" /></Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="Cód. Município Destino (IBGE)" value={cMunFim}
              onChange={(e) => setCMunFim(e.target.value)} maxLength={7} required />
          </Grid.Col>
          <Grid.Col span={5}>
            <TextInput label="Município Destino" value={xMunFim}
              onChange={(e) => setXMunFim(e.target.value)} required />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select label="UF Destino" data={UFS} value={ufFim}
              onChange={(v) => setUfFim(v || '')} searchable />
          </Grid.Col>

          <Grid.Col span={4}>
            <TextInput label="RNTRC" value={rntrc}
              onChange={(e) => setRntrc(e.target.value)} maxLength={8}
              description="Registro na ANTT" />
          </Grid.Col>
        </Grid>
      )}

      {/* Step 1 — Participantes */}
      {active === 1 && (
        <Stack gap="md">
          {renderParticipanteForm(remetente, setRemetente, 'Remetente')}
          {renderParticipanteForm(destinatario, setDestinatario, 'Destinatário')}
        </Stack>
      )}

      {/* Step 2 — Carga */}
      {active === 2 && (
        <Stack gap="md">
          <Grid>
            <Grid.Col span={4}>
              <Select label="Tipo de Carga" data={[
                { value: 'NORMAL', label: 'Carga Normal' },
                { value: 'VEICULO_NOVO', label: 'Veículo Novo' },
                { value: 'VEICULO_USADO', label: 'Veículo Usado' },
              ]} value={tipoCarga} onChange={(v) => {
                const tipo = (v as any) || 'NORMAL'
                setTipoCarga(tipo)
                if (tipo === 'VEICULO_NOVO') setProPred('VEICULO NOVO')
                else if (tipo === 'VEICULO_USADO') setProPred('VEICULO USADO')
              }} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput label="Produto Predominante" value={proPred}
                onChange={(e) => setProPred(e.target.value)} required />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput label="Valor da Carga (R$)" value={vCarga}
                onChange={(v) => setVCarga(Number(v) || 0)} min={0} decimalScale={2} />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput label="Peso Bruto (kg)" value={pesoBruto}
                onChange={(v) => setPesoBruto(Number(v) || 0)} min={0} decimalScale={4} />
            </Grid.Col>
          </Grid>

          {/* Veículos Novos */}
          {tipoCarga === 'VEICULO_NOVO' && (
            <>
              <Group justify="space-between">
                <Text fw={600}>Veículos Transportados</Text>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() =>
                  setVeiculosNovos([...veiculosNovos, { chassi: '', cCor: '', xCor: '', cMod: '', vUnit: 0, vFrete: 0 }])
                }>Adicionar Veículo</Button>
              </Group>
              {veiculosNovos.map((v, idx) => (
                <Paper key={idx} p="sm" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Badge>Veículo {idx + 1}</Badge>
                    <ActionIcon color="red" variant="subtle"
                      onClick={() => setVeiculosNovos(veiculosNovos.filter((_, i) => i !== idx))}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                  <Grid>
                    <Grid.Col span={4}>
                      <TextInput label="Chassi" value={v.chassi} maxLength={17} required
                        onChange={(e) => { const c = [...veiculosNovos]; c[idx] = { ...c[idx], chassi: e.target.value.toUpperCase() }; setVeiculosNovos(c) }} />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <TextInput label="Cód. Cor" value={v.cCor} maxLength={4}
                        onChange={(e) => { const c = [...veiculosNovos]; c[idx] = { ...c[idx], cCor: e.target.value }; setVeiculosNovos(c) }} />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <TextInput label="Cor" value={v.xCor}
                        onChange={(e) => { const c = [...veiculosNovos]; c[idx] = { ...c[idx], xCor: e.target.value }; setVeiculosNovos(c) }} />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <TextInput label="Cód. Modelo (DENATRAN)" value={v.cMod} maxLength={8}
                        onChange={(e) => { const c = [...veiculosNovos]; c[idx] = { ...c[idx], cMod: e.target.value }; setVeiculosNovos(c) }} />
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <NumberInput label="Valor Unitário (R$)" value={v.vUnit} min={0} decimalScale={2}
                        onChange={(val) => { const c = [...veiculosNovos]; c[idx] = { ...c[idx], vUnit: Number(val) || 0 }; setVeiculosNovos(c) }} />
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <NumberInput label="Valor Frete Unit. (R$)" value={v.vFrete} min={0} decimalScale={2}
                        onChange={(val) => { const c = [...veiculosNovos]; c[idx] = { ...c[idx], vFrete: Number(val) || 0 }; setVeiculosNovos(c) }} />
                    </Grid.Col>
                  </Grid>
                </Paper>
              ))}
              {veiculosNovos.length === 0 && (
                <Text size="sm" c="dimmed">Nenhum veículo adicionado. Clique em "Adicionar Veículo".</Text>
              )}
            </>
          )}

          {tipoCarga === 'VEICULO_USADO' && (
            <Text size="sm" c="dimmed">
              Para veículos usados, os dados do veículo constam na NF-e de venda vinculada.
              Informe as chaves NF-e no step correspondente.
            </Text>
          )}
        </Stack>
      )}

      {/* Step 3 — Valor da Prestação e ICMS */}
      {active === 3 && (
        <Grid>
          <Grid.Col span={12}><Divider label="Valor da Prestação" /></Grid.Col>
          <Grid.Col span={4}>
            <NumberInput label="Valor Total da Prestação (R$)" value={vTPrest}
              onChange={(v) => setVTPrest(Number(v) || 0)} min={0} decimalScale={2} required />
          </Grid.Col>
          <Grid.Col span={4}>
            <NumberInput label="Valor a Receber (R$)" value={vRec}
              onChange={(v) => setVRec(Number(v) || 0)} min={0} decimalScale={2} />
          </Grid.Col>

          <Grid.Col span={12}><Divider label="ICMS" /></Grid.Col>
          <Grid.Col span={4}>
            <Select label="CST ICMS" data={CST_ICMS} value={cstIcms}
              onChange={(v) => setCstIcms(v || '00')} />
          </Grid.Col>
          <Grid.Col span={3}>
            <NumberInput label="Base de Cálculo" value={bcIcms}
              onChange={(v) => setBcIcms(Number(v) || 0)} min={0} decimalScale={2} />
          </Grid.Col>
          <Grid.Col span={2}>
            <NumberInput label="Alíquota (%)" value={aliqIcms}
              onChange={(v) => setAliqIcms(Number(v) || 0)} min={0} max={100} decimalScale={2} />
          </Grid.Col>
          <Grid.Col span={3}>
            <NumberInput label="Valor ICMS" value={valorIcms}
              onChange={(v) => setValorIcms(Number(v) || 0)} min={0} decimalScale={2} />
          </Grid.Col>
        </Grid>
      )}

      {/* Step 4 — Seguros e Vale-Pedágio */}
      {active === 4 && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Seguros</Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={adicionarSeguro}>
              Adicionar Seguro
            </Button>
          </Group>
          {seguros.map((seg, idx) => (
            <Paper key={idx} p="sm" withBorder>
              <Group justify="space-between" mb="xs">
                <Badge>Seguro {idx + 1}</Badge>
                <ActionIcon color="red" variant="subtle"
                  onClick={() => setSeguros(seguros.filter((_, i) => i !== idx))}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
              <Grid>
                <Grid.Col span={4}>
                  <Select label="Responsável" data={RESP_SEGURO} value={seg.respSeg}
                    onChange={(v) => {
                      const copy = [...seguros]
                      copy[idx] = { ...copy[idx], respSeg: v || '4' }
                      setSeguros(copy)
                    }} />
                </Grid.Col>

                <Grid.Col span={4}>
                  <TextInput label="Seguradora" value={seg.xSeg}
                    onChange={(e) => {
                      const copy = [...seguros]
                      copy[idx] = { ...copy[idx], xSeg: e.target.value }
                      setSeguros(copy)
                    }} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput label="Nº Apólice" value={seg.nApol}
                    onChange={(e) => {
                      const copy = [...seguros]
                      copy[idx] = { ...copy[idx], nApol: e.target.value }
                      setSeguros(copy)
                    }} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput label="Nº Averbação" value={seg.nAver}
                    onChange={(e) => {
                      const copy = [...seguros]
                      copy[idx] = { ...copy[idx], nAver: e.target.value }
                      setSeguros(copy)
                    }} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <NumberInput label="Valor p/ Seguro" value={seg.vCarga}
                    onChange={(v) => {
                      const copy = [...seguros]
                      copy[idx] = { ...copy[idx], vCarga: Number(v) || 0 }
                      setSeguros(copy)
                    }} min={0} decimalScale={2} />
                </Grid.Col>
              </Grid>
            </Paper>
          ))}

          <Divider my="md" />

          <Group justify="space-between">
            <Text fw={600}>Vale-Pedágio</Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={adicionarValePedagio}>
              Adicionar Vale-Pedágio
            </Button>
          </Group>
          {valesPedagio.map((vp, idx) => (
            <Paper key={idx} p="sm" withBorder>
              <Group justify="space-between" mb="xs">
                <Badge color="orange">Vale-Pedágio {idx + 1}</Badge>
                <ActionIcon color="red" variant="subtle"
                  onClick={() => setValesPedagio(valesPedagio.filter((_, i) => i !== idx))}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
              <Grid>
                <Grid.Col span={4}>
                  <TextInput label="CNPJ Fornecedor" value={vp.cnpjForn}
                    onChange={(e) => {
                      const copy = [...valesPedagio]
                      copy[idx] = { ...copy[idx], cnpjForn: e.target.value }
                      setValesPedagio(copy)
                    }} maxLength={14} />
                </Grid.Col>

                <Grid.Col span={4}>
                  <TextInput label="Nº Comprovante" value={vp.nCompra}
                    onChange={(e) => {
                      const copy = [...valesPedagio]
                      copy[idx] = { ...copy[idx], nCompra: e.target.value }
                      setValesPedagio(copy)
                    }} />
                </Grid.Col>
                <Grid.Col span={4}>
                  <NumberInput label="Valor" value={vp.vValePed}
                    onChange={(v) => {
                      const copy = [...valesPedagio]
                      copy[idx] = { ...copy[idx], vValePed: Number(v) || 0 }
                      setValesPedagio(copy)
                    }} min={0} decimalScale={2} />
                </Grid.Col>
              </Grid>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Step 5 — NF-e Vinculadas */}
      {active === 5 && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>NF-e Vinculadas ao Transporte</Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={adicionarNFe}>
              Adicionar NF-e
            </Button>
          </Group>
          {nfesVinculadas.map((nfe, idx) => (
            <Group key={idx}>
              <TextInput
                style={{ flex: 1 }}
                label={`Chave de Acesso NF-e #${idx + 1}`}
                value={nfe.chave}
                onChange={(e) => {
                  const copy = [...nfesVinculadas]
                  copy[idx] = { chave: e.target.value }
                  setNfesVinculadas(copy)
                }}
                maxLength={44}
                placeholder="44 dígitos"
              />
              {nfesVinculadas.length > 1 && (
                <ActionIcon color="red" variant="subtle" mt={24} onClick={() => removerNFe(idx)}>
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Stack>
      )}

      {/* Step 6 — Revisão */}
      {active === 6 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md">Resumo da Emissão</Title>
          <Grid>
            <Grid.Col span={6}>
              <Text size="sm"><strong>Natureza:</strong> {naturezaOp}</Text>
              <Text size="sm"><strong>CFOP:</strong> {cfop}</Text>
              <Text size="sm"><strong>Modal:</strong> {MODAIS.find(m => m.value === modal)?.label}</Text>
              <Text size="sm"><strong>Série:</strong> {serie}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm"><strong>Remetente:</strong> {remetente.razaoSocial || '—'}</Text>
              <Text size="sm"><strong>Destinatário:</strong> {destinatario.razaoSocial || '—'}</Text>
              <Text size="sm"><strong>Origem:</strong> {xMunIni}/{ufIni}</Text>
              <Text size="sm"><strong>Destino:</strong> {xMunFim}/{ufFim}</Text>
            </Grid.Col>
            <Grid.Col span={12}><Divider my="xs" /></Grid.Col>
            <Grid.Col span={4}>
              <Text size="sm"><strong>Produto:</strong> {proPred}</Text>
              <Text size="sm"><strong>Valor Carga:</strong> R$ {vCarga.toFixed(2)}</Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text size="sm"><strong>Valor Prestação:</strong> R$ {vTPrest.toFixed(2)}</Text>
              <Text size="sm"><strong>ICMS:</strong> R$ {valorIcms.toFixed(2)}</Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text size="sm"><strong>NF-e vinculadas:</strong> {nfesVinculadas.filter(n => n.chave.length === 44).length}</Text>
              <Text size="sm"><strong>Seguros:</strong> {seguros.length}</Text>
              <Text size="sm"><strong>Vale-Pedágio:</strong> {valesPedagio.length}</Text>
            </Grid.Col>
          </Grid>

          <Textarea label="Informações Complementares" value={infCpl}
            onChange={(e) => setInfCpl(e.target.value)} mt="md" rows={3} />
        </Paper>
      )}

      {/* Navegação */}
      <Group justify="space-between" mt="xl">
        <Button variant="default" disabled={active === 0}
          onClick={() => setActive(active - 1)}>
          Anterior
        </Button>
        <Group>
          {active < totalSteps - 1 && (
            <Button onClick={() => setActive(active + 1)}>
              Próximo
            </Button>
          )}
          {active === totalSteps - 1 && (
            <Button color="green" loading={emitirMutation.isPending || atualizarMutation.isPending} onClick={handleEmitir}>
              {editandoId ? 'Atualizar CT-e' : 'Gravar CT-e'}
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  )
}
