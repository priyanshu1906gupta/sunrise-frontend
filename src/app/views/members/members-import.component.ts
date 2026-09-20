import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormControlDirective,
  TableDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import * as XLSX from 'xlsx';
import { AlertService } from '../../core/alert.service';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { toYmd } from '../../core/date';
import { TPipe } from '../../core/t.pipe';

export type MemberImportRow = {
  fullName: string;
  gender: string;
  joiningDate: string;
  phone: string;
  email: string;
  course: string;
  batch: string;
  className: string;
};

@Component({
  selector: 'app-members-import',
  templateUrl: './members-import.component.html',
  imports: [
    FormsModule,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    FormControlDirective,
    TableDirective,
    IconDirective,
    TPipe,
    RouterLink
  ]
})
export class MembersImportComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertService);
  private readonly i18n = inject(I18nService);

  readonly rows = signal<MemberImportRow[]>([]);
  readonly busy = signal(false);
  readonly summary = signal<{ created: number; updated: number; failed: number } | null>(null);
  readonly branchId = signal(this.route.snapshot.paramMap.get('branchId') || this.auth.branches()[0]?.id || '');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  get backLink(): string[] {
    const id = this.route.snapshot.paramMap.get('branchId');
    return id ? ['/branches', id, 'students'] : ['/students'];
  }

  get routeHasBranch(): boolean {
    return Boolean(this.route.snapshot.paramMap.get('branchId'));
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, unknown>[];
        this.rows.set(json.map((row: Record<string, unknown>) => this.mapRow(row)));
        this.summary.set(null);
      } catch {
        this.alerts.error(this.i18n.t('members.importParseError'));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateRow(index: number, field: keyof MemberImportRow, value: string): void {
    this.rows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  submit(): void {
    if (!this.rows().length) {
      this.alerts.error(this.i18n.t('members.importEmpty'));
      return;
    }
    const branchId = this.route.snapshot.paramMap.get('branchId') || this.branchId();
    if (!branchId) {
      this.alerts.error(this.i18n.t('members.importNeedBranch'));
      return;
    }
    this.busy.set(true);
    this.api
      .post<{ created: number; updated: number; failed: number }>('/students/import', {
        branchId,
        rows: this.rows()
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.summary.set(res);
          this.rows.set([]);
          const input = this.fileInput()?.nativeElement;
          if (input) input.value = '';
          this.alerts.success(this.i18n.t('members.importDone'));
        },
        error: (e) => {
          this.busy.set(false);
          this.alerts.error(apiErrorMessage(e));
        }
      });
  }

  private mapRow(row: Record<string, unknown>): MemberImportRow {
    const get = (...keys: string[]) => {
      const found = Object.entries(row).find(([key]) => keys.includes(key.trim().toLowerCase()));
      return found ? String(found[1] ?? '').trim() : '';
    };
    const joining = get('date of joining', 'joining date', 'joiningdate', 'date');
    const genderRaw = get('gender').toUpperCase();
    const gender =
      genderRaw === 'FEMALE' || genderRaw === 'F' || genderRaw === 'WOMAN'
        ? 'FEMALE'
        : genderRaw === 'OTHER' || genderRaw === 'O'
          ? 'OTHER'
          : 'MALE';
    return {
      fullName: get('full name', 'fullname', 'name'),
      gender,
      joiningDate: joining ? toYmd(joining) : toYmd(new Date()),
      phone: get('mobile', 'phone', 'phone number'),
      email: get('email'),
      course: get('course'),
      batch: get('batch'),
      className: get('class', 'classname', 'class name')
    };
  }
}
