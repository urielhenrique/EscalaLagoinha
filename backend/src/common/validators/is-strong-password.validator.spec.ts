import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { IsStrongPassword } from "./is-strong-password.validator";

class TestDto {
  @IsStrongPassword()
  password!: string;
}

describe("IsStrongPassword Validator", () => {
  it("should accept a strong password", async () => {
    const dto = plainToInstance(TestDto, { password: "Admin@123" });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should reject password shorter than 8 characters", async () => {
    const dto = plainToInstance(TestDto, { password: "Ab@1" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty("IsStrongPassword");
  });

  it("should reject password without uppercase letter", async () => {
    const dto = plainToInstance(TestDto, { password: "admin@123" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject password without number", async () => {
    const dto = plainToInstance(TestDto, { password: "Admin@abc" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject password without special character", async () => {
    const dto = plainToInstance(TestDto, { password: "Admin123" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject empty password", async () => {
    const dto = plainToInstance(TestDto, { password: "" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should accept password with various special characters", async () => {
    const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"];
    for (const char of specialChars) {
      const dto = plainToInstance(TestDto, {
        password: `Admin${char}123`,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });
});
