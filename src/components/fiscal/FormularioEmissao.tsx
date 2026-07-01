'use client'

import { useState } from 'react'
import {
  Stepper,
  Button,
  Group,
  Title,
  Text,
  Grid,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Stack,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconArrowLeft, IconArrowRight, IconSend } from '@tabler/icons-react'

// === Interfaces ===

export interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'product-search'
  required?: boolean
  span?: number // grid column span (1-12)
  options?: { value: string; label: string }[]
}

export interface StepConfig {
  label: string
  icon: React.ElementType
  fields: FieldConfig[]
  validate?: (values: Record<string, any>) => Record<string, string>
}

export interface FormularioEmissaoProps {
  tipo: 'NFE' | 'NFCE' | 'CTE' | 'MDFE' | 'NFSE'
  steps: StepConfig[]
  onSubmit: (dados: Record<string, any>) => Promise<void>
  initialData?: Partial<Record<string, any>>
  title: string
  breadcrumb: string
}

// === Component ===

export function FormularioEmissao({
  tipo,
  steps,
  onSubmit,
  initialData,
  title,
  breadcrumb,
}: FormularioEmissaoProps) {
  const [active, setActive] = useState(0)
  const [values, setValues] = useState<Record<string, any>>(initialData ?? {})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)

  function handleFieldChange(name: string, value: any) {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear error for the changed field
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validateCurrentStep(): boolean {
    const currentStep = steps[active]
    let stepErrors: Record<string, string> = {}

    // Run custom validate if provided
    if (currentStep.validate) {
      stepErrors = currentStep.validate(values)
    } else {
      // Default validation: check required fields
      for (const field of currentStep.fields) {
        if (field.required) {
          const val = values[field.name]
          if (val === undefined || val === null || val === '') {
            stepErrors[field.name] = `${field.label} é obrigatório`
          }
        }
      }
    }

    setErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  function handleNext() {
    if (validateCurrentStep()) {
      setActive((prev) => Math.min(prev + 1, steps.length - 1))
    }
  }

  function handleBack() {
    setActive((prev) => Math.max(prev - 1, 0))
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) return

    setIsPending(true)
    try {
      await onSubmit(values)
    } finally {
      setIsPending(false)
    }
  }

  function renderField(field: FieldConfig) {
    const commonProps = {
      label: field.label,
      error: errors[field.name],
      required: field.required,
      withAsterisk: field.required,
    }

    switch (field.type) {
      case 'text':
      case 'product-search':
        return (
          <TextInput
            {...commonProps}
            value={values[field.name] ?? ''}
            onChange={(e) => handleFieldChange(field.name, e.currentTarget.value)}
            placeholder={`Informe ${field.label.toLowerCase()}`}
          />
        )

      case 'number':
        return (
          <NumberInput
            {...commonProps}
            value={values[field.name] ?? ''}
            onChange={(val) => handleFieldChange(field.name, val)}
            placeholder={`Informe ${field.label.toLowerCase()}`}
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
          />
        )

      case 'select':
        return (
          <Select
            {...commonProps}
            data={field.options ?? []}
            value={values[field.name] ?? null}
            onChange={(val) => handleFieldChange(field.name, val)}
            placeholder={`Selecione ${field.label.toLowerCase()}`}
            searchable
            clearable
          />
        )

      case 'date':
        return (
          <DateInput
            {...commonProps}
            value={values[field.name] ?? null}
            onChange={(val) => handleFieldChange(field.name, val)}
            placeholder="DD/MM/AAAA"
            valueFormat="DD/MM/YYYY"
            clearable
          />
        )

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={values[field.name] ?? ''}
            onChange={(e) => handleFieldChange(field.name, e.currentTarget.value)}
            placeholder={`Informe ${field.label.toLowerCase()}`}
            rows={3}
          />
        )

      default:
        return null
    }
  }

  const isLastStep = active === steps.length - 1

  return (
    <Stack gap="lg">
      <div>
        <Text size="sm" c="dimmed" mb={4}>
          {breadcrumb}
        </Text>
        <Title order={3}>{title}</Title>
      </div>

      <Stepper active={active} size="sm">
        {steps.map((step, index) => (
          <Stepper.Step
            key={index}
            label={step.label}
            icon={<step.icon size={18} />}
          />
        ))}
      </Stepper>

      <Grid>
        {steps[active].fields.map((field) => (
          <Grid.Col key={field.name} span={field.span ?? 12}>
            {renderField(field)}
          </Grid.Col>
        ))}
      </Grid>

      <Group justify="space-between" mt="md">
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={handleBack}
          disabled={active === 0}
        >
          Voltar
        </Button>

        {isLastStep ? (
          <Button
            color="teal"
            leftSection={<IconSend size={16} />}
            onClick={handleSubmit}
            loading={isPending}
            disabled={isPending}
          >
            Emitir
          </Button>
        ) : (
          <Button
            rightSection={<IconArrowRight size={16} />}
            onClick={handleNext}
          >
            Próximo
          </Button>
        )}
      </Group>
    </Stack>
  )
}
