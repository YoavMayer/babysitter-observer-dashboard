import { render, screen } from "@/test/test-utils";
import { CatchUpBanner } from "../catch-up-banner";
import type { CatchUpState } from "@/hooks/use-batched-updates";

describe("CatchUpBanner", () => {
  it("renders nothing when catch-up mode is inactive", () => {
    const catchUp: CatchUpState = {
      active: false,
      bufferedCount: 0,
      flush: vi.fn(),
    };

    const { container } = render(<CatchUpBanner catchUp={catchUp} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner when catch-up mode is active", () => {
    const catchUp: CatchUpState = {
      active: true,
      bufferedCount: 12,
      flush: vi.fn(),
    };

    render(<CatchUpBanner catchUp={catchUp} />);

    expect(screen.getByTestId("catch-up-banner")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/runs updated while you were away/)).toBeInTheDocument();
  });

  it("shows the refresh button", () => {
    const catchUp: CatchUpState = {
      active: true,
      bufferedCount: 5,
      flush: vi.fn(),
    };

    render(<CatchUpBanner catchUp={catchUp} />);

    expect(screen.getByTestId("catch-up-refresh-btn")).toBeInTheDocument();
    expect(screen.getByText("Refresh now")).toBeInTheDocument();
  });

  it("calls flush when refresh button is clicked", async () => {
    const flush = vi.fn();
    const catchUp: CatchUpState = {
      active: true,
      bufferedCount: 8,
      flush,
    };

    render(<CatchUpBanner catchUp={catchUp} />);

    const button = screen.getByTestId("catch-up-refresh-btn");
    button.click();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("displays the correct buffered count", () => {
    const catchUp: CatchUpState = {
      active: true,
      bufferedCount: 42,
      flush: vi.fn(),
    };

    render(<CatchUpBanner catchUp={catchUp} />);

    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
